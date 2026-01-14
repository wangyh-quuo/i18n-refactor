import fg from "fast-glob";
import path from "path";

class Scanner {
  sourceDir: string = '';

  constructor(sourceDir: string) {
    this.sourceDir = sourceDir;
  }

  async scan() {
    const files = await fg([this.sourceDir + "/**/*"]);
    
    return files.reduce((acc, file) => {
      const ext = path.extname(file);
      if (!Object.hasOwn(acc, ext)) {
        acc[ext] = [];
      }
      acc[ext]!.push(file);
      return acc;
    }, {} as Record<string, string[]>);
  }


}

export default Scanner;