const fs = require("fs");
const path = require("path");
const fg = require("fast-glob");
const { parse } = require("@vue/compiler-sfc");
const { compile, transform } = require("@vue/compiler-dom");
const { exportToExcelByModule } = require("./packages/utils/exportToExcel");

const zhMap = {};
const existingJson = getExistingJson();
// 获取该模块的最后一个 id
const lastIds = getLastKeyId(existingJson);

function getLastKeyId() {
  const lastIds = {};

  function traverse(obj, prefix = null) {
    for (const key in obj) {
      if (typeof obj[key] === "object" && !Array.isArray(obj[key])) {
        traverse(obj[key], key);
      } else if (key.startsWith("key_")) {
        const id = parseInt(key.split("_")[1]);
        if (!lastIds[prefix] || id > lastIds[prefix]) {
          lastIds[prefix] = id;
        }
      }
    }
  }
  traverse(existingJson);
  return lastIds;
}

// 用于维护全局已生成的 key
const existingKeys = {};

// 获取或生成唯一的 key
function getKeyByText(text, prefix) {
  const clean = text.trim();

  // 如果已经存在，则直接返回对应的 key
  if (existingKeys[clean]) return existingKeys[clean];

  let id = lastIds[prefix] || 0; // 获取当前模块的最后一个 id，没有则从 1 开始
  // 生成新的 key
  const key = `${prefix}.key_${++id}`;
  existingKeys[clean] = key; // 记录该中文和 key 的映射关系

  // 更新模块的 ID
  lastIds[prefix] = id;

  zhMap[key] = clean; // 添加到最终的 zhMap
  return key;
}

function getPagePrefix(filePath) {
  const segments = filePath.split(path.sep);
  const pagesIndex = segments.indexOf("pages");
  if (pagesIndex >= 0 && segments.length > pagesIndex + 1) {
    return segments[pagesIndex + 1]; // 如 "home"
  }
  return "common"; // fallback
}

function flatToNested(flatObj) {
  const nested = {};
  for (const key in flatObj) {
    const parts = key.split(".");
    let current = nested;
    parts.forEach((part, index) => {
      if (!current[part]) {
        current[part] = index === parts.length - 1 ? flatObj[key] : {};
      }
      current = current[part];
    });
  }
  return nested;
}

function replaceChineseInTemplate(templateContent, filePath) {
  const ast = compile(templateContent, { mode: "module" }).ast;
  const prefix = getPagePrefix(filePath);
  const replacements = [];

  function walk(node) {
    if (node.type === 2) {
      const text = node.content.trim();
      if (text && /[\u4e00-\u9fa5]/.test(text)) {
        const key = getKeyByText(text, prefix);
        replacements.push({
          original: node.content,
          replacement: `{{ $t('${key}') }}`,
        });
      }
    }
    // 插槽
    else if (node.type === 12) {
      const text = node.content.content?.trim?.();
      if (text && /[\u4e00-\u9fa5]/.test(text)) {
        const key = getKeyByText(text, prefix);
        replacements.push({
          original: node.content.content,
          replacement: `{{ $t('${key}') }}`,
        });
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

  for (const { original, replacement } of replacements) {
    // 使用非贪婪替换，避免标签错位
    result = result.replace(
      new RegExp(`(?<!\\{\\{\\s*)${escapeRegExp(original)}(?!\\s*\\}\\})`, "g"),
      replacement
    );
  }

  return result;
}

function extractChineseFromScript(content, filePath) {
  const prefix = getPagePrefix(filePath);
  const stringReg = /(['"`])((?:\\\1|.)*?[\u4e00-\u9fa5]+.*?)(\1)/g;
  let replaced = content;
  let match;
  const done = new Set();

  while ((match = stringReg.exec(content)) !== null) {
    const fullMatch = match[0];
    const quote = match[1];
    const text = match[2];

    if (done.has(fullMatch)) continue;
    done.add(fullMatch);

    const key = getKeyByText(text, prefix);
    const replacement = `t('${key}')`;

    replaced = replaced.replace(fullMatch, replacement);
  }

  return replaced;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function processVueFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const { descriptor } = parse(raw);
  if (!descriptor.template) return;

  const template = descriptor.template.content;
  const templateReplaced = replaceChineseInTemplate(template, filePath);

  let scriptReplaced = raw;
  if (descriptor.script || descriptor.scriptSetup) {
    const scriptBlock = descriptor.scriptSetup || descriptor.script;
    const scriptContent = scriptBlock.content;
    const replacedScript = extractChineseFromScript(scriptContent, filePath);
    scriptReplaced = scriptReplaced.replace(scriptContent, replacedScript);
  }

  const fullReplaced = scriptReplaced.replace(template, templateReplaced);
  fs.writeFileSync(filePath, fullReplaced, "utf-8");
  console.log(`✅ 替换完成: ${filePath}`);
}

function processScriptFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const prefix = getPagePrefix(filePath);

  const stringReg = /(['"`])((?:\\\1|.)*?[\u4e00-\u9fa5]+.*?)(\1)/g;
  let replaced = content;
  let match;
  const done = new Set();

  while ((match = stringReg.exec(content)) !== null) {
    const fullMatch = match[0];
    const quote = match[1];
    const text = match[2];

    if (done.has(fullMatch)) continue;
    done.add(fullMatch);

    const key = getKeyByText(text, prefix);
    const replacement = `t('${key}')`;

    // 精准替换一次
    replaced = replaced.replace(fullMatch, replacement);
  }

  fs.writeFileSync(filePath, replaced, "utf-8");
  console.log(`🔧 JS/TS 替换完成: ${filePath}`);
}

function getExistingJson() {
  const zhFilePath = "locales/zh.json";

  let existingJson = {};
  if (fs.existsSync(zhFilePath)) {
    const existingContent = fs.readFileSync(zhFilePath, "utf-8");
    existingJson = JSON.parse(existingContent);
  }
  return existingJson;
}

function mergeZhJson(newJson) {
  // 使用递归合并现有的 JSON 和新生成的 JSON
  function deepMerge(target, source) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === "object" && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
  }

  deepMerge(existingJson, newJson);
  return existingJson;
}

async function main() {
  const vueFiles = await fg(["src/pages/**/*.vue"]);
  const scriptFiles = await fg(["src/pages/**/*.{js,ts}"]);

  for (const file of vueFiles) {
    await processVueFile(file);
  }

  for (const file of scriptFiles) {
    processScriptFile(file);
  }

  const nested = flatToNested(zhMap);
  const mergedZhJson = mergeZhJson(nested);

  fs.mkdirSync("locales", { recursive: true });
  fs.writeFileSync(
    "locales/zh.json",
    JSON.stringify(mergedZhJson, null, 2),
    "utf-8"
  );

  console.log("\n🎉 全部处理完成！已生成并合并: locales/zh.json");

  exportToExcelByModule(getExistingJson(), "./output/i18n.xlsx");
}

main();
