import { describe, expect, it } from "vitest";
import { fontFormatForFilename } from "../src/font-formats";
import { sha256Hex } from "../src/hash";

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
