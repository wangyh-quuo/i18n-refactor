import fs from "fs";
import path from "path";
import { parse } from "@vue/compiler-sfc";
import { parse as parseBabel } from '@babel/parser';
import traverse from './utils/babelTraverse';
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
import config from "./config";
import { matchRootDir } from "./utils";

type AllNode = ParentNode | ExpressionNode | TemplateChildNode | AttributeNode | DirectiveNode;


/**
 * 获取页面模块前缀
 * @param {string} filePath 文件路径
 * @returns {string} 模块前缀
 */
function getPagePrefix(filePath: string): string {
  const matchResult = matchRootDir(filePath, config.keyStrategy.prefixRoots);
  if (matchResult.matched) {
    const normalized = path.normalize(filePath); // 保证是平台风格路径
    const segments = normalized.replace(matchResult.root, '').split(path.sep).filter(Boolean);
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

function handleCompoundExpression(node: CompoundExpressionNode, prefix: string) {
  const children = node.children;
  const needReplace = children.every(c => typeof c === 'string' || (typeof c === 'object' && (c.type === NodeTypes.TEXT || c.type === NodeTypes.INTERPOLATION)));
  if (children.length && needReplace) {
    const pos = { start: 0, end: 0 };
    let combinedText = '';
    let i = 0;
    let tempList: string[] = [];
    children.forEach((child) => {
      if (typeof child === 'object') {
        const childPos = getSourceReplacePosition(child.loc);
        if (!pos.start) {
          pos.start = childPos.start;
        }
        if (child.type === NodeTypes.TEXT) {
          combinedText += child.content;
        } else if (child.type === NodeTypes.INTERPOLATION) {
          combinedText += `{${i}}`;
          tempList.push(child.content.loc.source);
          i++;
        }
        pos.end = childPos.end;
      }
    });
    const key = getKeyByText(combinedText, prefix);
    return {
      start: pos.start,
      end: pos.end,
      original: node.loc.source,
      source: node.loc.source,
      // $t('', { 0: xxx })
      replacement: `{{ $t('${key}', { ${tempList.map((_, index) => `${index}: ${tempList[index]}`).join(', ')} }) }}`
    }
  } else {
    if (/\$t\(.*\)$/.test(node.loc.source)) {
      return null  
    }
    // 混合表达式暂不支持自动替换
    if (/[\u4e00-\u9fa5]/.test(node.loc.source)) {
      console.warn('⚠️ 混合表达式暂不支持自动替换，请手动处理:', node.loc.source);
    }
  }
  return null;
}

/**
 * 替换模板中的中文文本
 * @param {string} templateContent 模板内容
 * @param {string} filePath 文件路径
 * @returns {string} 替换后的模板内容
 */
export function replaceChineseInTemplate(templateContent: string, filePath: string) {
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
      if(!nameLoc.source.startsWith(':') && node.value?.content && /[\u4e00-\u9fa5]/.test(node.value.content)) {
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
      const compoundReplace = handleCompoundExpression(node, prefix);
      if (compoundReplace) {
        replacements.push(compoundReplace);
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
export function extractChineseFromScript(content: string, filePath: string) {
  const ast = parseBabel(content, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx']
  });

  const result = new MagicString(content);
  
  traverse(ast, {
    StringLiteral(path) {
      const { node } = path;
      if (!/[\u4e00-\u9fff]/.test(node.value)) {
        return;
      }
      // 排除 import / key
      if (
        path.parent.type === 'ImportDeclaration' ||
        (path.parent.type === 'ObjectProperty' &&
         path.parent.key === node &&
         !path.parent.computed)
      )  {
        return;
      }
      const key = getKeyByText(node.value, getPagePrefix(filePath));
      result.overwrite(node.start!, node.end!, `t('${key}')`);
    },
    // 模板字符串 const msg = `你好${name}同学`; --> `${t('key_1', { 0: name })}`
    TemplateLiteral(path) {
      const { quasis, expressions } = path.node;
      const needReplace = quasis.some(q => /[\u4e00-\u9fa5]/.test(q.value.cooked || q.value.raw)) && 
       expressions.length && expressions.every(exp => ['Identifier', 'MemberExpression'].includes(exp.type));
      if (needReplace) {
        const pos = { start: 0, end: 0 };
        let combinedText = '';
        let i = 0;
        let tempList: string[] = [];
        const children = [...quasis, ...expressions].sort((a, b) => a.start! - b.start!);
        children.forEach(child => {
          if (!pos.start) {
            pos.start = child.start!;
          }
          if (child.type === 'TemplateElement') {
            combinedText += child.value.cooked || '';
          } else if (child.type === 'Identifier') {
            combinedText += `{${i}}`;
            tempList.push(child.name);
          }
          pos.end = child.end!;
        });
        const key = getKeyByText(combinedText, getPagePrefix(filePath));
        result.overwrite(pos.start, pos.end, `\${t('${key}', { ${tempList.map((_, index) => `${index}: ${tempList[index]}`).join(', ')} })}`);
        return;
      } else {
        quasis.forEach(quasi => {
          const cooked = quasi.value.cooked || quasi.value.raw;
          if (!/[\u4e00-\u9fff]/.test(cooked)) {
            return;
          }
          if (quasi.start == null || quasi.end == null) {
            return;
          }
          const key = getKeyByText(cooked, getPagePrefix(filePath));
          result.overwrite(quasi.start, quasi.end, `\${t('${key}')}`);
        });
      }
    }
  });
  return result.toString();
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
  const result = extractChineseFromScript(content, filePath);
  fs.writeFileSync(filePath, result, "utf-8");
  console.log(`🔧 JS/TS 替换完成: ${filePath}`);
}
