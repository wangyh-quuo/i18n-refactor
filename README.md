# 18n-refactor

An AST-based i18n refactoring tool for Vue & TypeScript projects.

i18n-refactor 是一个 基于 AST 的国际化自动重构工具，用于在 Vue / TypeScript 项目中自动完成国际化改造中确定且安全的部分。

工具目标不是 100% 全自动，而是：

在不破坏业务语义的前提下，最大化减少人工 i18n 成本

## ✨ 能做什么

✅ 基于 AST（非正则）精确定位字符串

✅ 支持 Vue SFC（template / script）

✅ 支持 JS / TS 文件

✅ 支持多行文本、插值、复合表达式

✅ 保持原有代码格式与换行（MagicString）

✅ 自动合并已有 i18n JSON，避免 key 覆盖

✅ 跨平台支持（Windows / macOS / Linux）

✅ 扫描仍未被 $t() / t() 包裹的中文

## 🚫 不会做的事（重要）

以下场景不会被自动替换，或会被标记为“待人工确认”：

逻辑判断 / 枚举值

status === '启用'


作为 key / 数据标识的字符串

getKeyByValue('牛')


语义不明确、可能影响业务逻辑的复杂表达式

设计原则：宁可少替，也不误替

## 📦 使用方式
```bash
npx i18n-refactor
```

具体命令参数与模式仍在整理中，当前以项目内使用为主。

## ⚙️ 配置文件

默认读取项目根目录下的：

i18n.config.js

基础示例
```javascript
module.exports = {
  sourceDir: 'src',

  output: {
    json: './locales/zh.json',
    excel: './output/i18n.xlsx',
  }

  defaultLocale: 'zh-CN',

  keyStrategy: {
    default: 'prefix_increment',
    prefixRoots: ['src/*'],
  }
}
```
## 🧠 工作方式（简述）

使用 Vue Compiler / Babel 解析 AST

根据字符串在 AST 中的语义位置判断其角色：

逻辑 / key / 枚举 → 跳过

UI 显示结果 → 自动国际化

使用 MagicString 进行一次性替换，保证格式不变

合并生成多语言 JSON

## 📄 中文扫描能力

工具会扫描并输出仍未被国际化的中文字符串，

用于人工补充或后续批量处理。

## 🛡 设计理念

语义安全优先

自动化 ≠ 全自动

工程可控 > 覆盖率

 ## 📌 适用场景

存量 Vue 项目国际化重构

大型项目中文清理

团队统一 i18n 改造基线

## 📜 License

MIT