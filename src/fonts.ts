import { App, TFile, normalizePath } from "obsidian";
import { BUNDLED_HANDWRITING_FONTS } from "./bundled-fonts";

export type FontSource = "system" | "bundled" | "custom";
export type FontDefinition = {
  id: string;
  name: string;
  family: string;
  source: FontSource;
  format: FontFormat;
};
export type FontFormat = "truetype" | "opentype" | "woff" | "woff2";
export type LoadedFont = FontDefinition & { available: boolean; faceCss: string };
export type CustomFontConfig = {
  id: string;
  name: string;
  path: string;
  format: FontFormat;
};

export const DEFAULT_HANDWRITING_FONT_ID = "sat-to";
export const CUSTOM_FONT_DIR = ".xhs-longform/fonts";

export async function loadHandwritingFonts(app: App, customFonts: CustomFontConfig[]): Promise<LoadedFont[]> {
  const system = await Promise.all(SYSTEM_HANDWRITING_FONTS.map(loadSystemFont));
  const custom = await Promise.all(customFonts.map(async (font): Promise<LoadedFont> => {
    const family = `XhsCustom${font.id.replace(/[^a-zA-Z0-9]/g, "")}`;
    const file = app.vault.getAbstractFileByPath(normalizePath(font.path));
    if (!(file instanceof TFile)) return { ...font, family, source: "custom", available: false, faceCss: "" };
    const bytes = new Uint8Array(await app.vault.readBinary(file));
    const dataUrl = `data:${mimeFor(font.format)};base64,${bytesToBase64(bytes)}`;
    return { ...font, family, source: "custom", available: true, faceCss: fontFaceCss(family, dataUrl, font.format) };
  }));
  return [...system, ...BUNDLED_HANDWRITING_FONTS, ...custom];
}

export function fallbackHandwritingFontId(fonts: LoadedFont[]): string {
  return fonts.find((font) => font.id === DEFAULT_HANDWRITING_FONT_ID && font.available)?.id
    ?? fonts.find((font) => font.available)?.id
    ?? DEFAULT_HANDWRITING_FONT_ID;
}

const SYSTEM_HANDWRITING_FONTS: Array<FontDefinition & { localNames: string[] }> = [
  { id: "sat-to", name: "平方洒脱体（本机）", family: "XhsPingFangSaTuo", source: "system", format: "truetype", localNames: ["平方洒脱体", "PingFangSaTuoTi"] },
  { id: "qiao-mu", name: "平方乔木体（本机）", family: "XhsPingFangQiaoMu", source: "system", format: "truetype", localNames: ["平方乔木体 Regular", "pingfangqiaomu", "平方乔木体", "PING FANG QIAO MU"] },
  { id: "san-sheng", name: "平方三生体（本机）", family: "XhsPingFangSanSheng", source: "system", format: "truetype", localNames: ["平方三生体", "PingFangSanShengTi"] },
  { id: "shi-guang", name: "平方时光体（本机）", family: "XhsPingFangShiGuang", source: "system", format: "truetype", localNames: ["平方时光体", "PingFangShiGuangTi"] },
  { id: "shang-shang-qian", name: "平方上上谦体（本机）", family: "XhsPingFangShangShangQian", source: "system", format: "truetype", localNames: ["平方上上谦体 Regular", "pingfangshangshangqian", "平方上上谦体", "PING FANG SHAGN SHANG QIAN"] },
  { id: "qing-chun", name: "平方青春体（本机）", family: "XhsPingFangQingChun", source: "system", format: "truetype", localNames: ["平方青春体 Regular", "-Regular", "平方青春体", "PING FANG QING CHUN"] }
];

async function loadSystemFont(font: FontDefinition & { localNames: string[] }): Promise<LoadedFont> {
  const source = font.localNames.map((name) => `local("${name}")`).join(",");
  const faceCss = `@font-face{font-family:"${font.family}";src:${source};font-style:normal;font-display:block;}`;
  try {
    await new FontFace(font.family, source).load();
    return { ...font, available: true, faceCss };
  } catch {
    return { ...font, available: false, faceCss: "" };
  }
}

function fontFaceCss(family: string, url: string, format: FontFormat): string {
  return `@font-face{font-family:"${family}";src:url("${url}") format("${format}");font-style:normal;font-display:block;}`;
}

function mimeFor(format: FontFormat): string {
  if (format === "woff2") return "font/woff2";
  if (format === "woff") return "font/woff";
  if (format === "opentype") return "font/otf";
  return "font/ttf";
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  return btoa(binary);
}
