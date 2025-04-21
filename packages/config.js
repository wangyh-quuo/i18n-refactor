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
  keyStrategy: 'prefix_increment', // or 'hash', 'fullpath'

  // 模块分组规则
  getPrefixFromPath: (filePath) => {
    const posixPath = filePath.replace(/\\/g, '/');
    const parts = posixPath.split('/');
    const idx = parts.indexOf('pages');
    return idx !== -1 && parts.length > idx + 1 ? parts[idx + 1] : 'common';
  },

  // Excel 导出是否每个模块一个 sheet
  excelByModule: true,

  // 是否保留 key 排序（按原始顺序 or 字母序）
  sortKeys: true,
};
