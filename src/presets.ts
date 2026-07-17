import type { SizeScale, StyleId, TextureId } from "./types";

export type Palette = {
  id: string; name: string; style: StyleId;
  bg: string; text: string; title: string; subtitle: string;
  highlightBg: string; highlightText?: string;
  tableHeadBg: string; tableHeadText: string;
  tableZebra: string; tableBorder: string;
  texture?: Exclude<TextureId, "auto" | "none">;
};

export const GEOMETRY = {
  width: 1080, height: 1440, padding: 88, contentWidth: 904,
  contentHeight: 1240, contentBottom: 1328, bottomSafe: 112,
  footerBottom: 40, footerSize: 34,
  paragraphGap: 20, subtitleTop: 32, subtitleBottom: 8,
  listItemGap: 4, listIndentEm: 1.2, titleBottom: 24,
  mediaMargin: 20, imageGap: 20, spacerHeight: 28,
  imageWidth: 904, imageHeight: 508, pairWidth: 442, pairHeight: 248,
  radius: 8, inlinePadding: 6,
  textureGrid: 88, textureDot: 56, textureLine: 104, textureStroke: 4
} as const;

export const TYPOGRAPHY = {
  pingfang: { title: [88, 800, 1.3], subtitle: [56, 700, 1.4], body: [46, 300, 1.6], bold: 600, table: [42, 300, 1.4], tableHead: 600 },
  handwrite: { title: [96, 700, 1.35], subtitle: [60, 700, 1.45], body: [52, 400, 1.65], bold: 700, table: [46, 400, 1.45], tableHead: 700 },
  headingLevelScale: { 1: 1, 2: 0.86, 3: 0.75 }
} as const;

export const SIZE_SCALES: Array<{ id: SizeScale; name: string }> = [
  { id: "80", name: "紧凑（80%）" },
  { id: "90", name: "偏小（90%）" },
  { id: "100", name: "标准（100%）" },
  { id: "110", name: "偏大（110%）" }
];

export const scaledSize = (base: number, scale: SizeScale): number => Math.round(base * Number(scale) / 100);

export const PALETTES: Palette[] = [
  { id: "paper-white", name: "纸白极简", style: "pingfang", bg: "#FAFAF8", text: "#1a1a1a", title: "#000000", subtitle: "#111111", highlightBg: "#FFF3B0", tableHeadBg: "#111111", tableHeadText: "#FFFFFF", tableZebra: "#F5F5F3", tableBorder: "#E8E8E8" },
  { id: "warm-apricot", name: "暖杏", style: "pingfang", bg: "#FDF6EE", text: "#3D2B1F", title: "#2D1B0E", subtitle: "#6B4D33", highlightBg: "#F5DFB8", tableHeadBg: "#3D2B1F", tableHeadText: "#FDF6EE", tableZebra: "#F8EDE0", tableBorder: "#E8D5C0" },
  { id: "green-field", name: "青野", style: "pingfang", bg: "#F4F7F0", text: "#2D3A25", title: "#1B2815", subtitle: "#3D5533", highlightBg: "#D4E8B8", tableHeadBg: "#2D3A25", tableHeadText: "#F4F7F0", tableZebra: "#EBF0E6", tableBorder: "#D0DDCA" },
  { id: "ink-black", name: "墨黑", style: "pingfang", bg: "#141414", text: "#D8D3CC", title: "#F0EBE5", subtitle: "#C9A855", highlightBg: "rgba(201,168,85,0.25)", highlightText: "#E8D9A0", tableHeadBg: "#2A2A2A", tableHeadText: "#C9A855", tableZebra: "#1A1A1A", tableBorder: "#2A2A2A" },
  { id: "cool-black", name: "冷淡黑", style: "handwrite", bg: "#F5F4F2", text: "#1A1A1A", title: "#000000", subtitle: "#333333", highlightBg: "#E0DFDC", tableHeadBg: "#1A1A1A", tableHeadText: "#F5F4F2", tableZebra: "#EEEDEB", tableBorder: "#DDDCDA", texture: "dot" },
  { id: "milk-tea", name: "奶茶", style: "handwrite", bg: "#F5EDE0", text: "#3D2B1F", title: "#2D1B0E", subtitle: "#7A5C3E", highlightBg: "#E8D5B0", tableHeadBg: "#3D2B1F", tableHeadText: "#F5EDE0", tableZebra: "#F0E4D3", tableBorder: "#DDD0BF", texture: "grid" },
  { id: "matcha", name: "抹茶", style: "handwrite", bg: "#E8EFD8", text: "#2D3A1F", title: "#1A2B0E", subtitle: "#4A6B35", highlightBg: "#C8DDA8", tableHeadBg: "#2D3A1F", tableHeadText: "#E8EFD8", tableZebra: "#DDE7C9", tableBorder: "#C8D8B8", texture: "dot" },
  { id: "peach", name: "蜜桃粉", style: "handwrite", bg: "#FBE8E0", text: "#3A1F1F", title: "#2B0E0E", subtitle: "#9A5548", highlightBg: "#F0CAB8", tableHeadBg: "#3A1F1F", tableHeadText: "#FBE8E0", tableZebra: "#F6DCD2", tableBorder: "#E8CFC5", texture: "grid" },
  { id: "lavender", name: "薰衣草", style: "handwrite", bg: "#EDE7F3", text: "#2D1F3A", title: "#1A0E2B", subtitle: "#6B4D8A", highlightBg: "#D5C8E8", tableHeadBg: "#2D1F3A", tableHeadText: "#EDE7F3", tableZebra: "#E4DBED", tableBorder: "#C8BDD8", texture: "line" }
];

export const paletteById = (id: string) => PALETTES.find((p) => p.id === id) ?? PALETTES[0]!;
