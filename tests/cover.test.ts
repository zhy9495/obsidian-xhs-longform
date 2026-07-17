import { describe, expect, it } from "vitest";
import { addCoverAuthor, authorTextVisible, limitAuthorSubtitle } from "../src/cover";
import { parseMarkdown } from "../src/parser";

describe("cover options", () => {
  it("shows author text only beside an avatar without a top cover image", () => {
    expect(authorTextVisible({ showAvatar: true, showCoverImage: false })).toBe(true);
    expect(authorTextVisible({ showAvatar: true, showCoverImage: true })).toBe(false);
    expect(authorTextVisible({ showAvatar: false, showCoverImage: false })).toBe(false);
  });

  it("adds a single author block before cover content", () => {
    const blocks = parseMarkdown("正文", "文档标题");
    const covered = addCoverAuthor(blocks, true, "小颖", "每天写一点", true, "data:image/jpeg;base64,test");
    expect(covered.map((block) => block.type)).toEqual(["author", "cover-title", "paragraph"]);
    expect(covered[0]).toMatchObject({ type: "author", nickname: "小颖", subtitle: "每天写一点", showText: true });
  });

  it("does not add an author block when avatar is disabled", () => {
    const blocks = parseMarkdown("正文", "文档标题");
    expect(addCoverAuthor(blocks, false, "小颖", "", true, "data:image/jpeg;base64,test")).toBe(blocks);
  });

  it("limits optional author text to 15 Unicode characters", () => {
    expect(limitAuthorSubtitle("  123456789012345678  ")).toBe("123456789012345");
    expect(limitAuthorSubtitle("🌿每天写一点就好呀呀呀呀呀呀呀呀呀呀")).toHaveLength(16);
    expect(Array.from(limitAuthorSubtitle("🌿每天写一点就好呀呀呀呀呀呀呀呀呀呀"))).toHaveLength(15);
  });
});
