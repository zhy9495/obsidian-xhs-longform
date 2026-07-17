import { describe, expect, it } from "vitest";
import { inlineLength, splitFlowBlock, splitInlines } from "../src/inline-utils";
import type { Inline, ListBlock } from "../src/types";

describe("inline AST splitting", () => {
  const value: Inline[] = [
    { type: "text", text: "前" },
    { type: "bold", children: [{ type: "text", text: "粗体" }, { type: "highlight", children: [{ type: "text", text: "高亮" }] }] },
    { type: "text", text: "后" }
  ];

  it("counts visible characters recursively", () => expect(inlineLength(value)).toBe(6));

  it("splits inside nested marks without losing their structure", () => {
    const [before, after] = splitInlines(value, 4);
    expect(before).toEqual([{ type: "text", text: "前" }, { type: "bold", children: [{ type: "text", text: "粗体" }, { type: "highlight", children: [{ type: "text", text: "高" }] }] }]);
    expect(after).toEqual([{ type: "bold", children: [{ type: "highlight", children: [{ type: "text", text: "亮" }] }] }, { type: "text", text: "后" }]);
  });

  it("splits lists within an item and keeps list semantics on both pages", () => {
    const list: ListBlock = { type: "list", ordered: false, items: [[{ type: "text", text: "abc" }], [{ type: "bold", children: [{ type: "text", text: "def" }] }]] };
    const [before, after] = splitFlowBlock(list, 4);
    expect(before).toMatchObject({ type: "list", items: [[{ type: "text", text: "abc" }], [{ type: "bold", children: [{ type: "text", text: "d" }] }]] });
    expect(after).toMatchObject({ type: "list", items: [[{ type: "bold", children: [{ type: "text", text: "ef" }] }]] });
  });
});
