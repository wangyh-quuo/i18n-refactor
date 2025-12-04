import fg from "fast-glob";
import fs from "fs";
import { processVueFile, processScriptFile } from './fileProcessor';
import { flatToNested, mergeZhJson } from './utils';
import { zhMap } from './keyGenerator';
import { exportToExcelByModule } from "./utils/exportToExcel";

import config from './config';

export async function main() {
  const vueFiles = await fg([config.sourceDir + "/**/*.vue"]);
  const scriptFiles = await fg([config.sourceDir +  "/**/*.{js,ts}"]);

  for (const file of vueFiles) {
    await processVueFile(file);
  }

  for (const file of scriptFiles) {
    processScriptFile(file);
  }

  const nested = flatToNested(zhMap);
  const mergedZhJson = mergeZhJson(nested);

  const localesDir =  config.output.json.split("/").slice(0, -1).join("/");
  fs.mkdirSync(localesDir, { recursive: true });
  fs.writeFileSync(
    config.output.json,
    JSON.stringify(mergedZhJson, null, 2),
    "utf-8"
  );

  console.log(`\n🎉 全部处理完成！已生成并合并: ${config.output.json}`);
  if (config.exportExcel) {
    exportToExcelByModule(mergedZhJson, config.output.excel);
  }
}
