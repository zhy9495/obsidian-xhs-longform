import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown } from "../src/parser";

describe("Markdown subset parser", () => {
  it("keeps inline formatting as an AST and strips link URLs", () => {
    expect(parseInline("a **粗 ==高亮==** [链接](https://example.com) `code`")) .toEqual([
      { type: "text", text: "a " },
      { type: "bold", children: [{ type: "text", text: "粗 " }, { type: "highlight", children: [{ type: "text", text: "高亮" }] }] },
      { type: "text", text: " 链接 " },
      { type: "code", children: [{ type: "text", text: "code" }] }
    ]);
  });

  it("uses the document name as cover and keeps Markdown heading levels", () => {
    const blocks = parseMarkdown("# 一级标题\n正文一\n---\n## 二级标题\n正文二", "文件标题");
    expect(blocks.map((block) => block.type)).toEqual(["cover-title", "subtitle", "paragraph", "subtitle", "paragraph"]);
    expect(blocks[1]).toMatchObject({ type: "subtitle", headingLevel: 1 });
    expect(blocks[3]).toMatchObject({ type: "subtitle", headingLevel: 2 });
  });

  it("pairs consecutive images across blank lines and leaves an odd final image", () => {
    const blocks = parseMarkdown("![[a.png]]\n\n![](b.jpg)\n![[c.webp]]");
    expect(blocks.map((block) => block.type)).toEqual(["image-pair", "image"]);
  });

  it("parses tables, lists, quotes and merges consecutive blank lines", () => {
    const blocks = parseMarkdown("| A | B |\n|---|---|\n| 1 | 2 |\n\n\n- x\n- y\n\n> q1\n> q2");
    expect(blocks.map((block) => block.type)).toEqual(["table", "spacer", "list", "spacer", "quote"]);
    expect(blocks[0]).toMatchObject({ type: "table", rows: [[[{ type: "text", text: "1" }], [{ type: "text", text: "2" }]]] });
  });
});
