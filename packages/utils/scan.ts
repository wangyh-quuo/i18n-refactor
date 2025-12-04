import fs from "fs";


const chineseRegexp = /[\u4e00-\u9fa5]/g;

/**
 * 判断文本是否已被翻译函数包裹
 * t('xx')
 * $t('xx')
 * :title="$t('xx')"
 * label: t('xx')
 */
function isWrappedByT(line) {
  // t( 或 $t(
  const tRegexp = /\$t\s*\(|\bt\s*\(/;
  return tRegexp.test(line);
}



function scanFileForUntranslated(filePath) {
  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  const untranslated = [];

  lines.forEach((line, index) => {
    if (chineseRegexp.test(line) && !isWrappedByT(line)) {
      untranslated.push({
        file: filePath,
        line: index + 1,
        text: line.trim(),
      });
    }
  });
  return untranslated;
}

function scanDirectoryForChinese(dir) {
  let results = []
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach((entry) => {
    const fullPath = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
       const untranslated = scanDirectoryForChinese(fullPath);
       if (untranslated.length > 0) {
        results.push(...untranslated);
      }
    } else if (entry.isFile() && /\.(vue|js|ts)$/.test(entry.name)) {
      const untranslated = scanFileForUntranslated(fullPath);
      if (untranslated.length > 0) {
        results.push(...untranslated);
      }
    }
  });
  return results;
}

module.exports = {
  scanDirectoryForChinese,
};