import fs from 'fs'
import path from 'path'
import { pathToFileURL } from "url";

import { context } from "./context";
import { getExistingJson } from "../generator/jsonGenerator";
import { getLastKeyId, initExistingKeys } from "../generator/keyGenerator";
import { merge, omit } from 'lodash-es';
import type { Options } from '../config/options';


function findProjectConfig(targetPath: string) {
  if (!fs.existsSync(targetPath)) {
    console.warn(`Path does not exist: ${targetPath}`);
    return null;
  }

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

async function loadProjectConfig(configPath: string | null) {
  if (!configPath) {
    return {}
  }
  const configUrl = pathToFileURL(configPath).href
  const config = await import(configUrl)
  return config.default || {}
}

export async function initContext() {
  console.log("Initializing context...");


  const targetPath = context.configPath || path.resolve('./')
  const userConfig = await loadProjectConfig(findProjectConfig(targetPath));
  context.config = merge(context.config, userConfig);

  context.existingJson = getExistingJson(context.config.output.json);
  context.lastIds = getLastKeyId(context.existingJson);
  context.existingKeys = initExistingKeys(context.existingJson);

  return context;
}

export function initOptions(options: Options) {
  if (options.config) {
    context.configPath = path.resolve(options.config);
  }
  context.config = merge(context.config, omit(options, 'config'));
}