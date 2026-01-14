export interface IParser {
  filePath: string;
  process(): void;
}