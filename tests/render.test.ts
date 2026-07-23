import { describe, expect, it } from "vitest";
import { getRenderCss } from "../src/render";
import type { ExportOptions } from "../src/types";

describe("adjustable typography", () => {
  it("scales title, subtitle, body, and table sizes independently", () => {
    const options: ExportOptions = {
      account: "test", style: "pingfang", paletteId: "paper-white", fontId: "sat-to", texture: "auto",
      titleScale: "80", subtitleScale: "90", bodyScale: "110", horizontalMargin: "88", topMargin: "88",
      showAvatar: false, showTitle: true, avatarDataUrl: "", avatarSize: "medium", authorSubtitle: "", coverImageDataUrl: "", showCoverImage: false
    };
    const css = getRenderCss(options, []);
    expect(css).toContain(".xhs-cover-title{font-size:70px");
    expect(css).toContain(".xhs-subtitle{font-size:50px");
    expect(css).toContain(".xhs-subtitle-2{font-size:43px}");
    expect(css).toContain(".xhs-paragraph{font-size:51px");
    expect(css).toContain("font-size:46px;font-weight:300");
    expect(css).toContain("gap:32px;margin:0 0 60px;min-height:132px");
    expect(css).toContain("width:132px;height:132px");
  });

  it("applies adjustable margins to content, media, and footer", () => {
    const options: ExportOptions = {
      account: "test", style: "pingfang", paletteId: "paper-white", fontId: "sat-to", texture: "auto",
      titleScale: "100", subtitleScale: "100", bodyScale: "100", horizontalMargin: "64", topMargin: "76",
      showAvatar: false, showTitle: true, avatarDataUrl: "", avatarSize: "medium", authorSubtitle: "", coverImageDataUrl: "", showCoverImage: false
    };
    const css = getRenderCss(options, []);
    expect(css).toContain("left:64px;top:76px;width:952px;height:1220px");
    expect(css).toContain(".xhs-image img,.xhs-motion img,.xhs-motion video{width:952px");
    expect(css).toContain(".xhs-image-pair img{width:466px");
  });

  it("renders small, medium, and large author layouts", () => {
    const base: ExportOptions = {
      account: "test", style: "pingfang", paletteId: "paper-white", fontId: "sat-to", texture: "auto",
      titleScale: "100", subtitleScale: "100", bodyScale: "100", horizontalMargin: "88", topMargin: "88",
      showAvatar: true, showTitle: true, avatarDataUrl: "data:image/webp;base64,test", avatarSize: "medium",
      authorSubtitle: "2026.07.17", coverImageDataUrl: "", showCoverImage: false
    };
    expect(getRenderCss({ ...base, avatarSize: "small" }, [])).toContain("min-height:108px");
    expect(getRenderCss(base, [])).toContain("min-height:132px");
    expect(getRenderCss({ ...base, avatarSize: "large" }, [])).toContain("min-height:156px");
  });

  it("reserves a shorter first-page content area below a full-width cover image", () => {
    const options: ExportOptions = {
      account: "test", style: "pingfang", paletteId: "paper-white", fontId: "sat-to", texture: "auto",
      titleScale: "100", subtitleScale: "100", bodyScale: "100", horizontalMargin: "88", topMargin: "88",
      showAvatar: true, showTitle: true, avatarDataUrl: "data:image/webp;base64,avatar", avatarSize: "medium",
      authorSubtitle: "每天写一点", coverImageDataUrl: "data:image/webp;base64,cover", showCoverImage: true
    };
    const css = getRenderCss(options, []);
    expect(css).toContain("height:608px;display:block;object-fit:cover");
    expect(css).toContain(".xhs-card-cover .xhs-content{top:542px;height:754px}");
    expect(css).toContain(".xhs-author-subtitle{margin-top:8px;font-size:31px");
    expect(css).toContain(".xhs-card-cover .xhs-author-text{align-self:center;padding:12px 18px");
  });
});
