const fs = require("fs");
const config = require("../config");

/**
 * 获取已存在的 zh.json 文件内容
 * @returns {Object} 解析后的 JSON 对象
 */
function getExistingJson() {
  const zhFilePath = config.output.json;

  let existingJson = {};
  if (fs.existsSync(zhFilePath)) {
    const existingContent = fs.readFileSync(zhFilePath, "utf-8");
    existingJson = JSON.parse(existingContent);
  }
  return existingJson;
}

/**
 * 合并现有的 JSON 和新生成的 JSON
 * @param {Object} newJson 新生成的 JSON 对象
 * @returns {Object} 合并后的 JSON 对象
 */
function mergeZhJson(newJson) {
  const existingJson = getExistingJson();
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

/**
 * 将扁平对象转换为嵌套对象
 * @param {Object} flatObj 扁平对象
 * @returns {Object} 嵌套对象
 */
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

/**
 * 转义正则表达式中的特殊字符
 * @param {string} str 输入的字符串
 * @returns {string} 转义后的字符串
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  getExistingJson,
  mergeZhJson,
  flatToNested,
  escapeRegExp
};
