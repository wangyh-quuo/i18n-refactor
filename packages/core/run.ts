import { writeJsonToFile } from "../generator/jsonGenerator";
import { parserFactory } from "../parser/parserFactory";
import Scanner from "../scanner";
import { initContext, initOptions } from "./init";
import { context } from "./context";

export async function run(options?: Record<string, any>) {
  initOptions(options || {});
  await initContext();
  const scanner = new Scanner(context.config.sourceDir);
  if (context.config.scan) {
    return scanner.scanProject();
  }

  const files = await scanner.scan();
  for (const filePath of files) {
    const parser = parserFactory.getParser(filePath);
    if (parser) {
      parser.process();
    }
  }

  writeJsonToFile();
}