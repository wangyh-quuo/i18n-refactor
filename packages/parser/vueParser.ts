import fs from "fs";
import { parse } from "@vue/compiler-sfc";

import { 
  compile,
  NodeTypes,
  type ParentNode,
  type SourceLocation,
  type ExpressionNode,
  type TemplateChildNode,
  type AttributeNode,
  type DirectiveNode,
  type CompoundExpressionNode,
} from "@vue/compiler-dom";

import type { IParser } from "./interface";
import { isChinese } from "../utils";
import { getKeyByText, getPagePrefix } from "../generator/keyGenerator";
import { Replacer } from "../replacer";
import { ScriptParser } from "./scriptParser";

type AllNode = ParentNode | ExpressionNode | TemplateChildNode | AttributeNode | DirectiveNode;


function getSourceReplacePosition(sourceLocation: SourceLocation) {
  const source = sourceLocation.source;
  let start = 0;
  let end = source.length;

  // 去掉前面的纯缩进（空格 + 换行）
  while (
    start < end &&
    (source[start] === ' ' ||
     source[start] === '\n' ||
     source[start] === '\r' ||
     source[start] === '\t')
  ) {
    start++;
  }

  // 去掉尾部的纯缩进
  while (
    end > start &&
    (source[end - 1] === ' ' ||
     source[end - 1] === '\n' ||
     source[end - 1] === '\r' ||
     source[end - 1] === '\t')
  ) {
    end--;
  }
  return {
    start: start + sourceLocation.start.offset,
    end: sourceLocation.end.offset - (source.length - end),
  }
}

export class VueParser implements IParser {
  filePath: string;
  rawContent: string;
  private templateContent: string;
  private scriptContent: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.rawContent = '';
    this.templateContent = "";
    this.scriptContent = "";
    this.parse();
  }

  private parse() {
    if (!fs.existsSync(this.filePath)) {
      return;
    }
    this.rawContent = fs.readFileSync(this.filePath, "utf-8");
    const { descriptor } = parse(this.rawContent);
    if (descriptor.template) {
      this.templateContent = descriptor.template.content;
    }
    if (descriptor.script || descriptor.scriptSetup) {
      const scriptBlock = descriptor.scriptSetup || descriptor.script;
      const scriptContent = scriptBlock?.content;
      if (scriptContent) {
        this.scriptContent = scriptContent;
      }
    }
  }

  private processTemplate(templateContent: string, filePath: string) {
    const ast = compile(templateContent, { mode: "module" }).ast;
    const prefix = getPagePrefix(filePath);
    const replacements: {
      start: number;
      end: number;
      original: string;
      source?: any;
      replacement: string;
    }[] = [];

    const handleCompoundExpression = this.handleCompoundExpression.bind(this);

    function walk(node: AllNode, replacement?: (k: string) => string) {
      if (node.type === NodeTypes.COMMENT) {
        return;
      }
      if (node.type === NodeTypes.TEXT) {
        const text = node.content.trim();
        if (text && isChinese(text)) {
          const key = getKeyByText(text, prefix);
          replacements.push({
            ...getSourceReplacePosition(node.loc),
            original: text,
            source: node.loc.source, // 换行文本兼容处理
            replacement: replacement ? replacement(key) : `{{ $t('${key}') }}`,
          });
        }
      }
      // if
      else if (node.type === NodeTypes.IF) {
        if (node.branches) {
          node.branches.forEach((branch) => walk(branch));
        }
      }
      // 插槽
      else if (node.type === NodeTypes.TEXT_CALL) {
        walk(node.content);
      }
      // 2. 标签属性中的中文
      else if (node.type === NodeTypes.ELEMENT && node.props) {
        node.props.forEach((prop) => walk(prop));
      }
      // 属性
      else if (node.type === NodeTypes.ATTRIBUTE) {
        const nameLoc = node.nameLoc;
        // 非动态绑定属性才需要添加 : 前缀
        if (
          !nameLoc.source.startsWith(":") &&
          node.value?.content &&
          isChinese(node.value.content)
        ) {
          replacements.push({
            ...getSourceReplacePosition(nameLoc),
            original: nameLoc.source,
            replacement: `:${nameLoc.source}`,
          });
        }
        // 处理属性值中的中文
        if (node.value) {
          walk(node.value, (k) => `"$t('${k}')"`);
        }
      }
      // 指令
      else if (node.type === NodeTypes.DIRECTIVE) {
        if (!node.exp) {
          return;
        }
        walk(node.exp);
      }
      // 表达式
      else if (node.type === NodeTypes.SIMPLE_EXPRESSION) {
        const text = node.content.trim();
        if (
          node.ast &&
          node.ast.type === "StringLiteral" &&
          text &&
          isChinese(text)
        ) {
          const key = getKeyByText(text, prefix);
          replacements.push({
            ...getSourceReplacePosition(node.loc),
            original: text,
            source: node.loc.source,
            replacement: replacement ? replacement(key) : `$t('${key}')`,
          });
        }
      } else if (node.type === NodeTypes.COMPOUND_EXPRESSION) {
        const compoundReplace = handleCompoundExpression(node, prefix);
        if (compoundReplace) {
          Array.isArray(compoundReplace)
            ? replacements.push(...compoundReplace)
            : replacements.push(compoundReplace);
        }
        return;
      } else if (node.type === NodeTypes.INTERPOLATION) {
        walk(node.content);
      }

      // ParentNode
      if ("children" in node && node.children) {
        node.children.forEach((child) => {
          if (typeof child === "object") {
            walk(child);
          }
        });
      }
    }

    walk(ast);

    return replacements;
  }

  private handleCompoundExpression(node: CompoundExpressionNode, prefix: string) {
    const children = node.children;
    const needReplace = children.every(c => typeof c === 'string' || (typeof c === 'object' && (c.type === NodeTypes.TEXT || c.type === NodeTypes.INTERPOLATION)));
    if (children.length && needReplace) {
      const pos = { start: 0, end: 0 };
      let combinedText = '';
      let i = 0;
      let tempList: string[] = [];
      children.forEach((child) => {
        if (typeof child === 'object') {
          const childPos = getSourceReplacePosition(child.loc);
          if (!pos.start) {
            pos.start = childPos.start;
          }
          if (child.type === NodeTypes.TEXT) {
            combinedText += child.content;
          } else if (child.type === NodeTypes.INTERPOLATION) {
            combinedText += `{${i}}`;
            tempList.push(child.content.loc.source);
            i++;
          }
          pos.end = childPos.end;
        }
      });
      if (!isChinese(combinedText)) {
        return null
      }
      const key = getKeyByText(combinedText, prefix);
      return {
        start: pos.start,
        end: pos.end,
        original: node.loc.source,
        source: node.loc.source,
        // $t('', { 0: xxx })
        replacement: `{{ $t('${key}', { ${tempList.map((_, index) => `${index}: ${tempList[index]}`).join(', ')} }) }}`
      }
    } else {
      if (/\$t\(.*\)$/.test(node.loc.source)) {
        return null  
      }
      if (node.ast && node.ast.type === 'ConditionalExpression') {
        return this.handleConditionalExpression(node, node.ast, prefix);
      }
      // 混合表达式暂不支持自动替换
      if (isChinese(node.loc.source)) {
        console.warn('⚠️ 混合表达式暂不支持自动替换，请手动处理:', node.loc.source);
      }
    }
    return null;
  }
  
  private handleConditionalExpression(node: CompoundExpressionNode, ast: CompoundExpressionNode['ast'], prefix: string): Array<{ start: number; end: number; original: string; source: string; replacement: string; }> {
    if (!ast || ast.type !== 'ConditionalExpression') {
      return []
    }
    const { consequent, alternate } = ast;
    const res = []
    if (consequent.type === 'StringLiteral' && isChinese(consequent.value)) {
      const key = getKeyByText(consequent.value, prefix);
      res.push({
        start: consequent!.start! + node.loc.start.offset - 1,
        end: consequent!.end! + node.loc.start.offset,
        original: consequent.value,
        source: consequent.value,
        replacement: `$t('${key}') `,
      });
    } else {
      res.push(...this.handleConditionalExpression(node, consequent, prefix));
    }
  
    if (alternate.type === 'StringLiteral' && isChinese(alternate.value)) {
      const key = getKeyByText(alternate.value, prefix);
      res.push({
        start: alternate!.start! + node.loc.start.offset - 1,
        end: alternate!.end! + node.loc.start.offset,
        original: alternate.value,
        source: alternate.value,
        replacement: `$t('${key}') `,
      });
    } else {
      res.push(...this.handleConditionalExpression(node, alternate, prefix));
    }
    return res
  }

  setScriptContent(scriptContent: string) {
    this.scriptContent = scriptContent;
  }

  setTemplateContent(templateContent: string) {
    this.templateContent = templateContent;
  }

  process() : string {
    const templateReplacements = this.processTemplate(this.templateContent, this.filePath);
    const scriptReplacements =  ScriptParser.parseScript(this.scriptContent, this.filePath);
    const templateReplacedContent = new Replacer(templateReplacements).replace(this.templateContent, this.filePath);
    const scriptReplacedContent = new Replacer(scriptReplacements).replace(this.scriptContent, this.filePath);
    const replacedContent = this.rawContent.replace(this.templateContent, templateReplacedContent).replace(this.scriptContent, scriptReplacedContent);
    return replacedContent;
  }
}
