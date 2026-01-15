import path from "path";

import type { IParser } from "./interface";
import { ScriptParser } from "./scriptParser";
import { VueParser } from "./vueParser";

export class parserFactory {
  static getParser(filePath: string): IParser | null {
    if (path.extname(filePath) === '.vue') {
      return new VueParser(filePath);
    } else if (['.js', '.ts', '.jsx', '.tsx'].includes(path.extname(filePath))) {
      return new ScriptParser(filePath);
    }
    return null;
  }
}

