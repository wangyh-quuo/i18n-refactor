import md5 from 'md5';
import config from './config';
import { getExistingJson } from './utils';

export const zhMap = {};
const existingJson = getExistingJson();
// 获取该模块的最后一个 id
const lastIds = getLastKeyId(existingJson);
// 用于维护全局已生成的 key
const existingKeys = initExistingKeys(existingJson);

/**
 * 获取该模块的最后一个 id
 * @param {Object} existingJson 已存在的 JSON 对象
 * @returns {Object} 每个模块的最后一个 id
 */
function getLastKeyId(existingJson) {
  const lastIds = {};

  function traverse(obj, prefix = null) {
    for (const key in obj) {
      if (typeof obj[key] === "object" && !Array.isArray(obj[key])) {
        traverse(obj[key], key);
      } else if (key.startsWith("key_")) {
        const id = parseInt(key.split("_")[1]);
        if (!lastIds[prefix] || id > lastIds[prefix]) {
          lastIds[prefix] = id;
        }
      }
    }
  }
  traverse(existingJson);
  return lastIds;
}

/**
 * 初始化已存在的 key
 * @param {Object} existingJson 已存在的 JSON 对象
 * @returns {Object} 中文文本和 key 的映射关系
 */
function initExistingKeys(existingJson) {
  const map = {};
  for (const module in existingJson) {
    const group = existingJson[module];
    for (const key in group) {
      const value = group[key];
      map[value] = `${module}.${key}`;
    }
  }
  return map;
}

/**
 * 获取或生成唯一的 key
 * @param {string} text 中文文本
 * @param {string} prefix 模块前缀
 * @returns {string} 唯一的 key
 */
export function getKeyByText(text, prefix) {
  const clean = text.trim();

  // 如果已经存在，则直接返回对应的 key
  if (existingKeys[clean]) return existingKeys[clean];

  let key = '';

  if (config.keyStrategy === 'prefix_increment') {
    let id = lastIds[prefix] || 0; // 获取当前模块的最后一个 id，没有则从 0 开始
    // 生成新的 key
    key = `${prefix}.key_${++id}`;
    // 更新模块的 ID
    lastIds[prefix] = id;
  } else if (config.keyStrategy === 'hash')  {
    const hash = md5(text).slice(0, 8); // 可控制长度
    key = `${prefix}.${hash}`;
  }

  existingKeys[clean] = key; // 记录该中文和 key 的映射关系
  zhMap[key] = clean; // 添加到最终的 zhMap
 
  return key;
}
