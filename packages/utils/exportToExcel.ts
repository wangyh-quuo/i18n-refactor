import xlsx from "xlsx";
import path from "path";
import fs from "fs";

/**
 * 将 zhMap 导出为 Excel 文件，如果文件不存在则自动创建
 * @param {object} zhMap 形式为 { key: zh }
 * @param {string} outputPath Excel 文件路径
 */
export function exportToExcel(zhMap: Record<string, string>, outputPath = "./output/i18n.xlsx") {
  const fullPath = path.resolve(outputPath);
  const outputDir = path.dirname(fullPath);

  // 如果目录不存在，先创建
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 已创建目录: ${outputDir}`);
  }

  const data = Object.entries(zhMap).map(([key, zh]) => ({
    key,
    zh_CN: zh,
    en_US: "", // 可预留翻译列
  }));
  console.log(data);

  const worksheet = xlsx.utils.json_to_sheet(data);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "i18n");
  xlsx.writeFile(workbook, fullPath);

  console.log(`✅ Excel 导出成功: ${fullPath}`);
}

/**
 * 多模块 i18n 导出为 Excel（每个模块一个 Sheet）
 * @param {object} mergedJson 合并后的 JSON，如 { home: { key_1: '首页' } }
 * @param {string} outputPath Excel 输出路径
 */
export function exportToExcelByModule(mergedJson: Record<string, any>, outputPath = "./output/i18n.xlsx") {
  const fullPath = path.resolve(outputPath);
  const outputDir = path.dirname(fullPath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 已创建目录: ${outputDir}`);
  }

  const workbook = xlsx.utils.book_new();

  for (const moduleKey of Object.keys(mergedJson)) {
    const moduleData = mergedJson[moduleKey];
    const data = Object.entries(moduleData).map(([key, zh]) => ({
      key,
      zh_CN: zh,
      en_US: "", // 可预留
    }));

    const sheet = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(workbook, sheet, moduleKey);
  }
  if (workbook.SheetNames.length === 0) {
    console.log("❌ 未找到任何数据，导出取消。");
    return;
  }

  xlsx.writeFile(workbook, fullPath);
  console.log(`✅ Excel（多 Sheet）导出成功: ${fullPath}`);
}
