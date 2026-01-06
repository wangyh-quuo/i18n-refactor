#!/usr/bin/env node

import { main } from '../extract-i18n';
import * as commander from 'commander';
import packageJson from '../../package.json'
import { scanProject } from '../utils/scan';
import config from '../config';

const program = new commander.Command()

program
  .version(`${packageJson.name} ${packageJson.version}`)
  .description(packageJson.description)
  .option('-s, --scan', '仅扫描未国际化的中文')
  .option('-c, --config <path>', '指定配置文件 (默认: i18n.config.js)', 'i18n.config.js')
  .action((options) => {
    if (options.scan) {
      scanProject(config.sourceDir);
    } else {
      main();
    }
  })
  .parse()
