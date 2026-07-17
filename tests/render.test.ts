import { describe, expect, it } from "vitest";
import { getRenderCss } from "../src/render";
import type { ExportOptions } from "../src/types";

describe("adjustable typography", () => {
  it("scales title, subtitle, body, and table sizes independently", () => {
    const options: ExportOptions = {
      account: "test", style: "pingfang", paletteId: "paper-white", fontId: "sat-to", texture: "auto",
      titleScale: "80", subtitleScale: "90", bodyScale: "110"
    };
    const css = getRenderCss(options, []);
    expect(css).toContain(".xhs-cover-title{font-size:70px");
    expect(css).toContain(".xhs-subtitle{font-size:50px");
    expect(css).toContain(".xhs-subtitle-2{font-size:43px}");
    expect(css).toContain(".xhs-paragraph{font-size:51px");
    expect(css).toContain("font-size:46px;font-weight:300");
  });
});
