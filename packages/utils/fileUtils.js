const fs = require('fs')
async function getAllVueFiles(dir) {
  const vueFiles = await fg([`${dir}/**/*.vue`]);
  const scriptFiles = await fg([`${dir}/**/*.{js,ts}`]);

  return {
    vue: vueFiles,
    script: scriptFiles
  }
}

function getExistingJson(zhFilePath) {
  let existingJson = {};
  if (fs.existsSync(zhFilePath)) {
    const existingContent = fs.readFileSync(zhFilePath, "utf-8");
    existingJson = JSON.parse(existingContent);
  }
  return existingJson;
}


function flatToNested(flatObj) {
  const nested = {};
  for (const key in flatObj) {
    const parts = key.split(".");
    let current = nested;
    parts.forEach((part, index) => {
      if (!current[part]) {
        current[part] = index === parts.length - 1 ? flatObj[key] : {};
      }
      current = current[part];
    });
  }
  return nested;
}

function mergeZhJson(newJson) {
  // 使用递归合并现有的 JSON 和新生成的 JSON
  function deepMerge(target, source) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === "object" && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
  }

  deepMerge(existingJson, newJson);
  return existingJson;
}


module.exports = {
  getAllVueFiles,
  getExistingJson,
  flatToNested,
  mergeZhJson
}