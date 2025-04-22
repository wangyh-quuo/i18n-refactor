const config = require('./config');

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