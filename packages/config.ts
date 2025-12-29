import fs from 'fs'
import path from 'path'
import { merge } from 'lodash-es'
import { pathToFileURL } from 'url'

const targetPath = process.argv[2] || path.resolve('./')

function findProjectConfig(targetPath: string) {
  let dir = fs.statSync(targetPath).isDirectory()
    ? targetPath
    : path.dirname(targetPath)

  const root = path.parse(dir).root

  while (dir !== root) {
    const configPath = path.join(dir, 'i18n.config.js')

    if (fs.existsSync(configPath)) {
      return configPath
    }

    dir = path.dirname(dir)
  }

  return null
}

async function loadProjectConfig(configPath: string) {
  if (!configPath) {
    return {}
  }
  const configUrl = pathToFileURL(configPath).href
  const config = await import(configUrl)
  return config.default || {}
}

const defaultConfig = {
  // 要扫描的目录
  sourceDir: 'src/pages',

  // 输出的 JSON 和 Excel 路径
  output: {
    json: './locales/zh.json',
    excel: './output/i18n.xlsx',
  },

  // 支持的语言列表
  languages: ['zh_CN', 'en_US'],

  // 是否导出 Excel
  exportExcel: true,

  // key 生成规则（可以后面提供多个策略）
  keyStrategy: 'prefix_increment', // prefix_increment or 'hash'
}

const projectConfig = await loadProjectConfig(findProjectConfig(path.resolve(targetPath)) || '');

export default merge(
  defaultConfig, 
  projectConfig
);
