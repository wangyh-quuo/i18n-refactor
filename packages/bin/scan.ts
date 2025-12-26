#!/usr/bin/env node

import { scanDirectoryForChinese } from '../utils/scan';
import config from '../config';

function scanProject(rootDir: string) {
  const results = scanDirectoryForChinese(rootDir);

  if (results.length === 0) {
    console.log("🎉 未发现未国际化的中文！");
    return;
  }

  console.log(`\n🚨 发现 ${results.length} 处未国际化中文：\n`);

  results.forEach(r => {
    console.log(`📄 ${r.file}`);
    console.log(`   👉 行 ${r.line}: ${r.text}`);
  });

  console.log("\n⚠️ 请手动处理或加入自动国际化流程。\n");
}

scanProject(config.sourceDir);