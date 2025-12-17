import fs from "fs";
import path from "path";
import { parse } from "@vue/compiler-sfc";
import { compile, NodeTypes, type RootNode, type TemplateChildNode } from "@vue/compiler-dom";
import { getKeyByText } from './keyGenerator';
import { escapeRegExp } from './utils/index';
import config from "./config";

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

/**
 * 替换模板中的中文文本
 * @param {string} templateContent 模板内容
 * @param {string} filePath 文件路径
 * @returns {string} 替换后的模板内容
 */
function replaceChineseInTemplate(templateContent: string, filePath: string) {
  const ast = compile(templateContent, { mode: "module" }).ast;
  const prefix = getPagePrefix(filePath);
  const replacements: { original: any; source?: any; replacement: string; }[] = [];

  function walk(node: RootNode | TemplateChildNode) {
    if (node.type === NodeTypes.TEXT) {
      const text = node.content.trim();
      if (text && /[\u4e00-\u9fa5]/.test(text)) {
        const key = getKeyByText(text, prefix);
        replacements.push({
          original: text,
          source: node.loc.source, // 换行文本兼容处理
          replacement: `{{ $t('${key}') }}`,
        });
      }
    }
    // if
    else if(node.type === NodeTypes.IF) {
      if (node.branches) {
        node.branches.forEach(walk);
      }
    }
    // 插槽
    else if (node.type === NodeTypes.TEXT_CALL) {
      const text = node.content.content?.trim?.();
      if (text && /[\u4e00-\u9fa5]/.test(text)) {
        const key = getKeyByText(text, prefix);
        replacements.push({
          original: text,
          replacement: `{{ $t('${key}') }}`,
        });
      }
    }
    // 2. 标签属性中的中文
    else if (node.type === NodeTypes.ELEMENT && node.props) {
      for (const prop of node.props) {
        if (
          prop.type === NodeTypes.ATTRIBUTE && // ATTRIBUTE
          prop.value &&
          /[\u4e00-\u9fa5]/.test(prop.value.content)
        ) {
          const raw = prop.value.content;
          const key = getKeyByText(raw, prefix);
          const attrName = prop.name;

          // 替换整个属性为 :attr="$t('key')"
          replacements.push({
            original: `${attrName}="${raw}"`,
            replacement: `:${attrName}="$t('${key}')"`,
          });
        }
      }
    }

    if (node.children) {
      node.children.forEach(walk);
    }
  }

  walk(ast);

  let result = templateContent;

  // 避免重复替换：长字符串先替换
  replacements.sort((a, b) => b.original.length - a.original.length);

  for (const { original, replacement, source } of replacements) {
    let replaceText = source ?? original
    // 使用非贪婪替换，避免标签错位
    result = result.replace(
      new RegExp(`(?<!\\{\\{\\s*)${escapeRegExp(replaceText)}(?!\\s*\\}\\})`, "g"),
      replacement
    );
  }

  return result;
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
