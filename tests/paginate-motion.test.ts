import { describe, expect, it } from "vitest";
import { paginate } from "../src/paginate";
import type { Block } from "../src/types";
import type { LayoutMeasurer } from "../src/measure";

describe("dynamic media pagination", () => {
  it("keeps at most one dynamic block on each page", () => {
    const blocks: Block[] = [
      { type: "motion", id: "motion-1", link: "a.mp4", alt: "", format: "mp4" },
      { type: "paragraph", inlines: [{ type: "text", text: "说明" }] },
      { type: "motion", id: "motion-2", link: "b.mov", alt: "", format: "mov" }
    ];
    const measurer = {
      contentHeight: 1240,
      firstPageContentHeight: 1240,
      measure: (block: Block) => block.type === "motion" ? 548 : 100,
      minimumHeight: () => 100,
      splitToHeight: () => [null, null]
    } as unknown as LayoutMeasurer;
    const pages = paginate(blocks, measurer);
    expect(pages).toHaveLength(2);
    expect(pages.map((page) => page.blocks.filter((block) => block.type === "motion").length)).toEqual([1, 1]);
    expect(pages[0]!.blocks.map((block) => block.type)).toEqual(["motion", "paragraph"]);
  });
});
