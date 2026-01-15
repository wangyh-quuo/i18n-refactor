import { context } from "../core/context";

const logSet = new Set<string>();

export function loggerDryRun(filePath: string, source: string, replacement: string) {
  if (context.config.dryRun) {
    if (!logSet.has(`${filePath}`)) {
      logSet.add(`${filePath}`);
      console.log(`[DRY RUN] Would modify: ${filePath}`);
    }
    console.log(`[DRY RUN] Would add key: ${replacement} from ${source.trim()}`);
  }
}