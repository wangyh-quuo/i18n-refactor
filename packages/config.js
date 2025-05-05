// i18n.config.js（或 config.ts）

module.exports = {
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
};
