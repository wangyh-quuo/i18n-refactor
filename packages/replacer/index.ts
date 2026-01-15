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
    if (!context.config.dryRun) {
      fs.writeFileSync(filePath, replacedContent, "utf-8");
      console.log(`✅ 替换完成: ${filePath}`);
    }
    return replacedContent;
  }
}
