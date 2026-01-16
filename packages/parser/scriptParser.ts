import fs from "fs";
import { parse as parseBabel } from "@babel/parser";

import type { IParser } from "./interface";
import traverse from '../utils/babelTraverse';
import { getKeyByText, getPagePrefix } from "../generator/keyGenerator";
import { containsHTML, isChinese } from "../utils";
import { Replacer } from "../replacer";
import { context } from "../core/context";

export class ScriptParser implements IParser {
  filePath: string;
  rawContent: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.rawContent = "";
    if (fs.existsSync(filePath)) {
      this.rawContent = fs.readFileSync(filePath, "utf-8");
    }
  }
  
  static parseScript(content: string, filePath: string) {
    const ast = parseBabel(content, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
    });

    const replacements: {
      start: number;
      end: number;
      original: string;
      source?: any;
      replacement: string;
    }[] = [];

    traverse(ast, {
      StringLiteral(path) {
        const { node } = path;
        if (!/[\u4e00-\u9fff]/.test(node.value)) {
          return;
        }
        // 排除 import / key
        if (
          path.parent.type === "ImportDeclaration" ||
          (path.parent.type === "ObjectProperty" &&
            path.parent.key === node &&
            !path.parent.computed)
        ) {
          return;
        }
        const key = getKeyByText(node.value, getPagePrefix(filePath));
        replacements.push({
          start: node.start!,
          end: node.end!,
          original: node.value,
          source: node.value,
          replacement: `t('${key}')`,
        });
      },
      // 模板字符串 const msg = `你好${name}同学`; --> `${t('key_1', { 0: name })}`
      TemplateLiteral(path) {
        const { quasis, expressions } = path.node;
        if (quasis.some((q) => containsHTML(q.value.cooked || q.value.raw))) {
          
          context.notReplaceFiles.push({
            source: quasis.map(q => q.value.cooked || q.value.raw).join("${...}"),
            filePath: filePath,
            reason: '模板字符串中包含HTML，暂不支持自动替换',
          })
          return;
        }

        const needReplace =
          quasis.some((q) => isChinese(q.value.cooked || q.value.raw)) &&
          expressions.length &&
          expressions.every((exp) =>
            ["Identifier", "MemberExpression"].includes(exp.type)
          );
        if (needReplace) {
          const pos = { start: 0, end: 0 };
          let combinedText = "";
          let i = 0;
          let tempList: string[] = [];
          const children = [...quasis, ...expressions].sort(
            (a, b) => a.start! - b.start!
          );
          children.forEach((child) => {
            if (!pos.start) {
              pos.start = child.start!;
            }
            if (child.type === "TemplateElement") {
              combinedText += child.value.cooked || "";
            } else if (child.type === "Identifier") {
              combinedText += `{${i}}`;
              tempList.push(child.name);
            }
            pos.end = child.end!;
          });
          const key = getKeyByText(combinedText, getPagePrefix(filePath));
          replacements.push({
            start: pos.start,
            end: pos.end,
            original: combinedText,
            source: combinedText,
            replacement: `\${t('${key}', { ${tempList.map((_, index) => `${index}: ${tempList[index]}`).join(", ")} })}`});
          return;
        } else {
          quasis.forEach((quasi) => {
            const cooked = quasi.value.cooked || quasi.value.raw;
            if (!/[\u4e00-\u9fff]/.test(cooked)) {
              return;
            }
            if (quasi.start == null || quasi.end == null) {
              return;
            }
            const key = getKeyByText(cooked, getPagePrefix(filePath));
            replacements.push({
              start: quasi.start,
              end: quasi.end,
              original: cooked,
              source: cooked,
              replacement: `\${t('${key}')}`,
            });
          });
        }
      },
    });
    return replacements;
  }

  process(): string {
    const replacements = ScriptParser.parseScript(this.rawContent, this.filePath);
    return new Replacer(replacements).replace(this.rawContent, this.filePath);
  }
}
