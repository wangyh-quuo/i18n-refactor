export interface IConfig {
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
  dryRun?: boolean
  scan?: boolean
}

const DEFAULT_SOURCE_DIR = 'src'

export default {
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
} as IConfig;