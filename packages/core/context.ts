import config, { type IConfig } from '../config/index';

export interface IContext {
  configPath?: string;
  config: IConfig;
  zhMap: Record<string, string>;
  existingJson: Record<string, string>;
  lastIds: Record<string, number>;
  existingKeys: Record<string, string>;
}

function createContext(config: IConfig): IContext {
  return {
    config,
    zhMap: {},
    existingJson: {},
    lastIds: {},
    existingKeys: {},
  }
}

export const context: IContext = createContext(config);