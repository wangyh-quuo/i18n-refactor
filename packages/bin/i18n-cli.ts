#!/usr/bin/env node

import * as commander from 'commander';
import packageJson from '../../package.json'
import { run } from '../core/run';

const program = new commander.Command()

program
  .version(`${packageJson.name} ${packageJson.version}`)
  .description(packageJson.description)
  .option('-s, --scan', '仅扫描未国际化的中文')
  .option('-c, --config <path>', '指定配置文件 (默认: i18n.config.js)', 'i18n.config.js')
  .option('--dry-run', '只分析，不写文件')
  .action((options) => {
    const start = performance.now();
    run(options).finally(() => {
      console.log(`\n⏱️ 耗时: ${(performance.now() - start).toFixed(2)} ms`);
    })
  })
  .parse()
