import path from "path";

/**
 * 转义正则表达式中的特殊字符
 * @param {string} str 输入的字符串
 * @returns {string} 转义后的字符串
 */
export function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


/**
 * 匹配文件路径是否符合指定的目录模式
 * @param {string} filePath 文件路径
 * @param {string[]} patterns 目录模式数组
 * @returns {Object} { matched: boolean, root: string }
 */
export function matchRootDir(filePath: string, patterns: string[]) {
  const normalized = path.normalize(filePath);
  for (const pattern of patterns) {
    const normalizedPattern = path.normalize(pattern);
    // 精确目录：src/pages
    if (!normalizedPattern.endsWith(path.normalize('/*'))) {
      if (normalized.startsWith(normalizedPattern + path.sep)) {
        return { matched: true, root: normalizedPattern }
      }
      continue;
    }
    // 通配目录：src/*
    const baseDir = normalizedPattern.replace(path.normalize('/*'), '');
    if (!normalized.startsWith(baseDir + path.sep)) {
      continue;
    }
    // src/a/b/c.vue => b/c.vue
    const rest = normalized.slice(baseDir.length + 1);
    const segments = rest.split(path.sep);
    if (segments.length >= 2) {
      return { matched: true, root: baseDir + path.sep + segments[0] }
    }
  }
  return { matched: false, root: '' }
}

export function isChinese(str: string) {
  return /[\u4e00-\u9fa5]/.test(str);
}
