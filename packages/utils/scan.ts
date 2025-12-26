import fs from "fs";


const chineseRegexp = /[\u4e00-\u9fa5]/g;

/**
 * 判断文本是否已被翻译函数包裹
 * t('xx')
 * $t('xx')
 * :title="$t('xx')"
 * label: t('xx')
 */
function isWrappedByT(line: string) {
  // t( 或 $t(
  const tRegexp = /\$t\s*\(|\bt\s*\(/;
  return tRegexp.test(line);
}



function scanFileForUntranslated(filePath: fs.PathOrFileDescriptor) {
  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  const untranslated: { file: fs.PathOrFileDescriptor; line: number; text: string; }[] = [];

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

export function scanDirectoryForChinese(dir: fs.PathLike) {
  let results: { file: fs.PathOrFileDescriptor; line: number; text: string; }[] = []
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