import fs from "fs";
import MagicString from "magic-string";

import { loggerDryRun } from "../core/dryRun";
import { context } from "../core/context";

interface IReplacement {
  start: number;
  end: number;
  original: string;
  source?: any;
  replacement: string;
}

export class Replacer {
  replacements: IReplacement[] = [];

  constructor(replacements: IReplacement[]) {
    this.replacements = replacements;
  }

  replace(raw: string, filePath: string) {
    const content = new MagicString(raw);
    for (const r of this.replacements) {
      content.overwrite(r.start, r.end, r.replacement);
      loggerDryRun(filePath, r.source, r.replacement);
    }
    const replacedContent = content.toString();
    return replacedContent;
  }

  static updateFile(filePath: string, replacedContent: string) {
    if (!context.config.dryRun) {
      fs.writeFileSync(filePath, replacedContent, "utf-8");
      console.log(`✅ 处理完成: ${filePath}`);
    }

    console.log(`----------------------------------------`);
    context.notReplaceFiles.forEach(item => {
      console.log(`⚠️ 未替换内容: ${item.source.trim()}，原因: ${item.reason}, 位置: ${item.filePath}`);
    })
  }
}
