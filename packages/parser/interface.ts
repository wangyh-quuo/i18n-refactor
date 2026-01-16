export interface IParser {
  filePath: string;
  process(): string;
}