import fs from 'fs'
import path from 'path'
import { merge } from 'lodash-es'
import { pathToFileURL } from 'url'

type Config = {
  sourceDir: string
  output: {
    json: string
    excel: string
  }
  languages: string[]
  exportExcel: boolean
  keyStrategy: {
    default: string
    prefixRoots: string[] // ['src/*']
  }
} 


// const targetPath = process.argv[2] || path.resolve('./')
const targetPath = path.resolve('./')

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

const DEFAULT_SOURCE_DIR = 'src'

const defaultConfig: Config = {
  // 要扫描的目录
  sourceDir: DEFAULT_SOURCE_DIR,

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
  keyStrategy: {
    default: 'prefix_increment', // prefix_increment or 'hash'
    prefixRoots: [`${DEFAULT_SOURCE_DIR}/*`], // 作为模块前缀的根目录列表
  },
}

const projectConfig: Config = await loadProjectConfig(findProjectConfig(path.resolve(targetPath)) || '');

export default merge(
  defaultConfig, 
  projectConfig
);
