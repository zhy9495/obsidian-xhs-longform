import { describe, expect, it } from "vitest";
import { fontFormatForFilename } from "../src/font-formats";
import { sha256Hex } from "../src/hash";
import { fontWidthsDiffer } from "../src/font-detection";

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

describe("downloaded font integrity", () => {
  it("computes a SHA-256 digest", async () => {
    const bytes = new TextEncoder().encode("abc").buffer;
    await expect(sha256Hex(bytes)).resolves.toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("system font detection", () => {
  it("accepts a font when its measured widths differ from a fallback", () => {
    expect(fontWidthsDiffer([100, 110, 120], [101, 111, 121])).toBe(true);
  });

  it("rejects a missing font that resolves to the fallback widths", () => {
    expect(fontWidthsDiffer([100, 110, 120], [100, 110, 120])).toBe(false);
  });
});
