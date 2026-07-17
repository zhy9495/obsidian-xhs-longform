import { describe, expect, it } from "vitest";
import { fontFormatForFilename } from "../src/font-formats";

describe("custom font validation", () => {
  it("accepts supported font formats case-insensitively", () => {
    expect(fontFormatForFilename("handwriting.TTF")).toBe("truetype");
    expect(fontFormatForFilename("handwriting.otf")).toBe("opentype");
    expect(fontFormatForFilename("handwriting.woff")).toBe("woff");
    expect(fontFormatForFilename("handwriting.woff2")).toBe("woff2");
  });

  it("rejects files that are not fonts", () => {
    expect(fontFormatForFilename("font.zip")).toBeNull();
    expect(fontFormatForFilename("font.ttf.exe")).toBeNull();
  });
});
