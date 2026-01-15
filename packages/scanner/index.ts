import fg from "fast-glob";
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

class Scanner {
  sourceDir: string = "";

  constructor(sourceDir: string) {
    this.sourceDir = sourceDir;
  }
 
  async scan() {
    const files = await fg([this.sourceDir + "/**/*.{vue,js,ts,jsx,tsx}"]);
    return files;
  }

  scanFileForUntranslated(filePath: fs.PathOrFileDescriptor) {
    const lines = fs.readFileSync(filePath, "utf-8").split("\n");
    const untranslated: {
      file: fs.PathOrFileDescriptor;
      line: number;
      text: string;
    }[] = [];

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

  scanDirectoryForChinese(dir: fs.PathLike) {
    let results: {
      file: fs.PathOrFileDescriptor;
      line: number;
      text: string;
    }[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach((entry) => {
      const fullPath = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        const untranslated = this.scanDirectoryForChinese(fullPath);
        if (untranslated.length > 0) {
          results.push(...untranslated);
        }
      } else if (entry.isFile() && /\.(vue|js|ts)$/.test(entry.name)) {
        const untranslated = this.scanFileForUntranslated(fullPath);
        if (untranslated.length > 0) {
          results.push(...untranslated);
        }
      }
    });
    return results;
  }

  scanProject(rootDir: string) {
    const results = this.scanDirectoryForChinese(rootDir);

    if (results.length === 0) {
      console.log("🎉 未发现未国际化的中文！");
      return;
    }

    console.log(`\n🚨 发现 ${results.length} 处未国际化中文：\n`);

    results.forEach((r) => {
      console.log(`📄 ${r.file}`);
      console.log(`   👉 行 ${r.line}: ${r.text}`);
    });

    console.log("\n⚠️ 请手动处理或加入自动国际化流程。\n");
  }
}

export default Scanner;
