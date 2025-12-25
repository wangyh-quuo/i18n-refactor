import fs from "fs";
import path from "path";
import { parse } from "@vue/compiler-sfc";
import MagicString from 'magic-string';
import { 
  compile,
  NodeTypes,
  type ParentNode,
  type SourceLocation,
  type ExpressionNode,
  type TemplateChildNode,
  type AttributeNode,
  type DirectiveNode,
  type CompoundExpressionNode,
} from "@vue/compiler-dom";
import { getKeyByText } from './keyGenerator';
import { escapeRegExp } from './utils/index';
import config from "./config";

type AllNode = ParentNode | ExpressionNode | TemplateChildNode | AttributeNode | DirectiveNode;


/**
 * 获取页面模块前缀
 * @param {string} filePath 文件路径
 * @returns {string} 模块前缀
 */
function getPagePrefix(filePath: string): string {
  const normalized = path.normalize(filePath); // 保证是平台风格路径
  const sourceDir = path.normalize(config.sourceDir + '/');
  const segments = normalized.replace(sourceDir, '').split(path.sep);
  // 不包含.后缀的文件夹名称作为模块前缀
  if (segments.length > 0 && segments[0]!.indexOf('.') === -1) {
    return segments[0]!; // 如 "home"
  }
  return "common"; // fallback
}

function getSourceReplacePosition(sourceLocation: SourceLocation) {
  const source = sourceLocation.source;
  let start = 0;
  let end = source.length;

  // 去掉前面的纯缩进（空格 + 换行）
  while (
    start < end &&
    (source[start] === ' ' ||
     source[start] === '\n' ||
     source[start] === '\r' ||
     source[start] === '\t')
  ) {
    start++;
  }

  // 去掉尾部的纯缩进
  while (
    end > start &&
    (source[end - 1] === ' ' ||
     source[end - 1] === '\n' ||
     source[end - 1] === '\r' ||
     source[end - 1] === '\t')
  ) {
    end--;
  }
  return {
    start: start + sourceLocation.start.offset,
    end: sourceLocation.end.offset - (source.length - end),
  }
}

function classifyCompound(node: CompoundExpressionNode) {
  let hasText = false;
  let hasLogic = false;

  for (const c of node.children) {
    if (typeof c === 'string' && /[\u4e00-\u9fff]/.test(c)) {
      hasText = true;
    } else if (typeof c === 'object') {
      hasLogic = true;
    }
  }

  if (hasText && !hasLogic) return 'TEXT_ONLY';
  if (hasText && hasLogic) return 'MIXED';
  return 'NO_TEXT';
}

/**
 * 替换模板中的中文文本
 * @param {string} templateContent 模板内容
 * @param {string} filePath 文件路径
 * @returns {string} 替换后的模板内容
 */
function replaceChineseInTemplate(templateContent: string, filePath: string) {
  const ast = compile(templateContent, { mode: "module" }).ast;
  const prefix = getPagePrefix(filePath);
  const replacements: { start: number; end: number; original: string; source?: any; replacement: string; }[] = [];

  function walk(node: AllNode, replacement?: (k: string) => string) {
    if (node.type === NodeTypes.COMMENT) {
      return;
    }
    if (node.type === NodeTypes.TEXT) {
      const text = node.content.trim();
      if (text && /[\u4e00-\u9fa5]/.test(text)) {
        const key = getKeyByText(text, prefix);
        replacements.push({
          ...getSourceReplacePosition(node.loc),
          original: text,
          source: node.loc.source, // 换行文本兼容处理
          replacement: replacement? replacement(key) : `{{ $t('${key}') }}`,
        });
      }
    }
    // if
    else if(node.type === NodeTypes.IF) {
      if (node.branches) {
        node.branches.forEach(branch => walk(branch));
      }
    }
    // 插槽
    else if (node.type === NodeTypes.TEXT_CALL) {
      walk(node.content);
    }
    // 2. 标签属性中的中文
    else if (node.type === NodeTypes.ELEMENT && node.props) {
      node.props.forEach(prop => walk(prop));
    }
    // 属性
    else if (node.type === NodeTypes.ATTRIBUTE) { 
      const nameLoc = node.nameLoc;
      // 非动态绑定属性才需要添加 : 前缀
      if(!nameLoc.source.startsWith(':')) {
        replacements.push({
          ...getSourceReplacePosition(nameLoc),
          original: nameLoc.source,
          replacement: `:${nameLoc.source}`,
        });
      }
      // 处理属性值中的中文
      if (node.value) {
        walk(node.value, (k) => `"$t('${k}')"`);
      }
    }
    // 指令
    else if (node.type === NodeTypes.DIRECTIVE) { 
      if (!node.exp) {
        return
      }
      walk(node.exp);
    }
    // 表达式
    else if (node.type === NodeTypes.SIMPLE_EXPRESSION) {
      const text = node.content.trim();
      if (node.ast && node.ast.type === 'StringLiteral' && text && /[\u4e00-\u9fa5]/.test(text)) {
        const key = getKeyByText(text, prefix);
        replacements.push({
          ...getSourceReplacePosition(node.loc),
          original: text,
          source: node.loc.source,
          replacement: replacement ? replacement(key) : `$t('${key}')`,
        });
      } else {
        console.warn('⚠️ 混合表达式暂不支持自动替换，请手动处理:', node.loc.source);
      }
    }
    else if (node.type === NodeTypes.COMPOUND_EXPRESSION) {
      const classify = classifyCompound(node);
      if (classify === 'TEXT_ONLY') {
        node.children.forEach((child) => {
        if (typeof child === 'object') {
          walk(child);
        }
      });
      } else if (classify === 'MIXED') { 
        console.warn('⚠️ 混合表达式暂不支持自动替换，请手动处理:', node.loc.source);
      }
      return
    }
    else if (node.type === NodeTypes.INTERPOLATION) {
      walk(node.content);
    }

    // ParentNode
    if ('children' in node && node.children) {
      node.children.forEach((child) => {
        if (typeof child === 'object') {
          walk(child);
        }
      });
    }
  }

  walk(ast);

  const result = new MagicString(templateContent);

  // 避免重复替换：长字符串先替换
  replacements.sort((a, b) => b.original.length - a.original.length);

  for (const { start, end, replacement } of replacements) {
    result.overwrite(start, end, replacement);
  }
  return result.toString();
}

/**
 * 从脚本中提取并替换中文文本
 * @param {string} content 脚本内容
 * @param {string} filePath 文件路径
 * @returns {string} 替换后的脚本内容
 */
function extractChineseFromScript(content: string, filePath: string) {
  const prefix = getPagePrefix(filePath);
  const chineseRegexp = /(["'`])([^"'`\n]*[\u4e00-\u9fa5]+[^"'`\n]*)\1/g;
  const replacements = [];

  let match;
  while ((match = chineseRegexp.exec(content)) !== null) {
    // const quote = match[1];
    const raw = match[2];
    const fullMatch = match[0];

    const key = getKeyByText(raw ?? '', prefix);
    const replacement = `t('${key}')`;

    // 保证只替换值部分，不误替换整体结构
    replacements.push({
      original: fullMatch,
      replacement
    });
  }

  // 避免重复替换
  replacements.sort((a, b) => b.original.length - a.original.length);

  let result = content;
  for (const { original, replacement } of replacements) {
    result = result.replace(new RegExp(escapeRegExp(original), "g"), replacement);
  }

  return result;
}

/**
 * 处理 Vue 文件
 * @param {string} filePath 文件路径
 */
export async function processVueFile(filePath: string) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const { descriptor } = parse(raw);
  if (!descriptor.template) return;

  const template = descriptor.template.content;
  const templateReplaced = replaceChineseInTemplate(template, filePath);

  let scriptReplaced = raw;
  if (descriptor.script || descriptor.scriptSetup) {
    const scriptBlock = descriptor.scriptSetup || descriptor.script;
    const scriptContent = scriptBlock?.content;
    const replacedScript = extractChineseFromScript(scriptContent ?? '', filePath);
    scriptReplaced = scriptReplaced.replace(scriptContent ?? '', replacedScript);
  }

  const fullReplaced = scriptReplaced.replace(template, templateReplaced);
  fs.writeFileSync(filePath, fullReplaced, "utf-8");
  console.log(`✅ 替换完成: ${filePath}`);
}

/**
 * 处理 JS/TS 文件
 * @param {string} filePath 文件路径
 */
export function processScriptFile(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  const prefix = getPagePrefix(filePath);

  const stringReg = /(['"`])((?:\\\1|[\s\S])*?[\u4e00-\u9fa5]+[\s\S]*?)(\1)/g;
  let replaced = content;
  let match;
  const done = new Set();

  while ((match = stringReg.exec(content)) !== null) {
    const fullMatch = match[0];
    // const quote = match[1];
    const text = match[2];

    if (done.has(fullMatch)) continue;
    done.add(fullMatch);

    const key = getKeyByText(text ?? '', prefix);
    const replacement = `t('${key}')`;

    // 精准替换一次
    replaced = replaced.replace(fullMatch, replacement);
  }

  fs.writeFileSync(filePath, replaced, "utf-8");
  console.log(`🔧 JS/TS 替换完成: ${filePath}`);
}
