import fs from "fs";

import { context } from "../core/context";
import { exportToExcelByModule } from "../utils/exportToExcel";

/**
 * 获取已存在的 zh.json 文件内容
 * @returns {Object} 解析后的 JSON 对象
 */
export function getExistingJson(jsonPath: string) {
  let existingJson: Record<string, any> = {};
  if (fs.existsSync(jsonPath)) {
    const existingContent = fs.readFileSync(jsonPath, "utf-8");
    existingJson = JSON.parse(existingContent);
  }
  return existingJson;
}

/**
 * 将扁平对象转换为嵌套对象
 * @param {Object} flatObj 扁平对象
 * @returns {Object} 嵌套对象
 */
export function flatToNested(flatObj: Record<string, string>) {
  const nested: Record<string, any> = {};
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
 * 合并现有的 JSON 和新生成的 JSON
 * @param {Object} newJson 新生成的 JSON 对象
 * @returns {Object} 合并后的 JSON 对象
 */
export function mergeZhJson(newJson: Record<string, any>) {
  const existingJson = getExistingJson(context.config.output.json);
  // 使用递归合并现有的 JSON 和新生成的 JSON
  function deepMerge(target: Record<string, any>, source: Record<string, any>) {
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


export function writeJsonToFile() {
  const nested = flatToNested(context.zhMap);
  const mergedZhJson = mergeZhJson(nested);

  const localesDir =  context.config.output.json.split("/").slice(0, -1).join("/");
  fs.mkdirSync(localesDir, { recursive: true });
  fs.writeFileSync(
    context.config.output.json,
    JSON.stringify(mergedZhJson, null, 2),
    "utf-8"
  );

  console.log(`\n🎉 全部处理完成！已生成并合并: ${context.config.output.json}`);

  if (context.config.exportExcel) {
    exportToExcelByModule(mergedZhJson, context.config.output.excel);
  }
}