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


// 用于维护全局已生成的 key
const existingKeys = {};

// 获取或生成唯一的 key
function getKeyByText(text, prefix) {
  const clean = text.trim();

  // 如果已经存在，则直接返回对应的 key
  if (existingKeys[clean]) return existingKeys[clean];

  let id = lastIds[prefix] || 0; // 获取当前模块的最后一个 id，没有则从 1 开始
  // 生成新的 key
  const key = `${prefix}.key_${++id}`;
  existingKeys[clean] = key; // 记录该中文和 key 的映射关系

  // 更新模块的 ID
  lastIds[prefix] = id;

  zhMap[key] = clean; // 添加到最终的 zhMap
  return key;
}

module.exports = {
  getLastKeyId,
  getKeyByText
}
