import { GEOMETRY as G, paletteById, scaledSize, TYPOGRAPHY } from "./presets";
import type { Block, ExportOptions, Inline, Page } from "./types";
import type { LoadedFont } from "./fonts";

export function getRenderCss(options: ExportOptions, fonts: LoadedFont[]): string {
  const palette = paletteById(options.paletteId);
  const type = TYPOGRAPHY[options.style];
  const loaded = fonts.find((font) => font.id === options.fontId && font.available);
  const family = options.style === "handwrite" && loaded
    ? `"${loaded.family}",cursive`
    : '-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC",sans-serif';
  const texture = options.texture === "auto" ? palette.texture : options.texture;
  const textureImage = texture === "grid"
    ? `linear-gradient(to right,currentColor ${G.textureStroke}px,transparent ${G.textureStroke}px),linear-gradient(to bottom,currentColor ${G.textureStroke}px,transparent ${G.textureStroke}px)`
    : texture === "dot"
      ? `radial-gradient(circle,currentColor 0 ${G.textureStroke}px,transparent ${G.textureStroke}px)`
      : texture === "line"
        ? `linear-gradient(to bottom,transparent 0,transparent ${G.textureLine - G.textureStroke}px,currentColor ${G.textureLine - G.textureStroke}px)`
        : "none";
  const textureSize = texture === "grid" ? `${G.textureGrid}px ${G.textureGrid}px` : texture === "dot" ? `${G.textureDot}px ${G.textureDot}px` : `${G.textureLine}px ${G.textureLine}px`;
  const textureOpacity = texture === "dot" ? ".05" : ".035";
  const [, titleWeight, titleLine] = type.title;
  const [, subtitleWeight, subtitleLine] = type.subtitle;
  const [, bodyWeight, bodyLine] = type.body;
  const [, tableWeight, tableLine] = type.table;
  const titleSize = scaledSize(type.title[0], options.titleScale);
  const subtitleSize = scaledSize(type.subtitle[0], options.subtitleScale);
  const subtitle2Size = Math.round(subtitleSize * TYPOGRAPHY.headingLevelScale[2]);
  const subtitle3Size = Math.round(subtitleSize * TYPOGRAPHY.headingLevelScale[3]);
  const bodySize = scaledSize(type.body[0], options.bodyScale);
  const tableSize = scaledSize(type.table[0], options.bodyScale);

  return `${options.style === "handwrite" ? (loaded?.faceCss ?? "") : ""}
*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:${family};color:${palette.text};background:transparent}
.xhs-card{position:relative;width:${G.width}px;height:${G.height}px;overflow:hidden;background:${palette.bg};color:${palette.text}}
.xhs-card::before{content:"";position:absolute;inset:0;background-image:${textureImage};background-size:${textureSize};color:${palette.text};opacity:${textureOpacity};z-index:0;pointer-events:none}
.xhs-content{position:absolute;z-index:1;left:${G.padding}px;top:${G.padding}px;width:${G.contentWidth}px;height:${G.contentHeight}px;overflow:hidden;display:flex;flex-direction:column}
.xhs-block{display:flow-root;flex:0 0 auto;width:100%;overflow-wrap:anywhere;word-break:normal;line-break:strict;white-space:normal}
.xhs-cover-title{font-size:${titleSize}px;font-weight:${titleWeight};line-height:${titleLine};color:${palette.title};margin:0 0 ${G.titleBottom}px}
.xhs-subtitle{font-size:${subtitleSize}px;font-weight:${subtitleWeight};line-height:${subtitleLine};color:${palette.subtitle};margin:${G.subtitleTop}px 0 ${G.subtitleBottom}px}
.xhs-subtitle-2{font-size:${subtitle2Size}px}.xhs-subtitle-3{font-size:${subtitle3Size}px}
.xhs-paragraph{font-size:${bodySize}px;font-weight:${bodyWeight};line-height:${bodyLine};margin:0 0 ${G.paragraphGap}px}
.xhs-quote,.xhs-code-block{font-size:${bodySize}px;font-weight:${bodyWeight};line-height:${bodyLine};margin:0 0 ${G.paragraphGap}px;padding:${G.inlinePadding * 2}px ${G.inlinePadding * 3}px;border-left:${G.inlinePadding / 2}px solid ${palette.subtitle};background:${palette.tableZebra};color:${palette.text};white-space:pre-wrap}
.xhs-list{font-size:${bodySize}px;font-weight:${bodyWeight};line-height:${bodyLine};margin:0 0 ${G.paragraphGap}px;padding-left:${G.listIndentEm}em}
.xhs-list li{margin:${G.listItemGap}px 0;padding:0}
.xhs-bold{font-weight:${type.bold}}.xhs-italic{font-style:italic}.xhs-highlight{background:${palette.highlightBg};color:${palette.highlightText ?? "inherit"};border-radius:${G.radius}px;padding:0 ${G.inlinePadding}px}
.xhs-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:${palette.highlightBg};border-radius:${G.radius}px;padding:0 ${G.inlinePadding}px}
.xhs-table-wrap{margin:${G.mediaMargin}px 0;width:100%}.xhs-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:${tableSize}px;font-weight:${tableWeight};line-height:${tableLine}}
.xhs-table th,.xhs-table td{padding:${G.inlinePadding * 2}px ${G.inlinePadding * 3}px;text-align:left;vertical-align:top;border-bottom:${G.textureStroke / 4}px solid ${palette.tableBorder};overflow-wrap:anywhere}
.xhs-table th{font-weight:${type.tableHead};background:${palette.tableHeadBg};color:${palette.tableHeadText}}.xhs-table tbody tr:nth-child(even){background:${palette.tableZebra}}
.xhs-image,.xhs-image-pair{margin:${G.mediaMargin}px 0;display:flex;gap:${G.imageGap}px}.xhs-image img{width:${G.imageWidth}px;height:${G.imageHeight}px}.xhs-image-pair img{width:${G.pairWidth}px;height:${G.pairHeight}px}
.xhs-image img,.xhs-image-pair img{display:block;object-fit:cover;object-position:center;border-radius:${G.radius}px}
.xhs-spacer{height:${G.spacerHeight}px}
.xhs-continues-next{margin-bottom:0}
.xhs-footer{position:absolute;z-index:1;left:${G.padding}px;right:${G.padding}px;bottom:${G.footerBottom}px;height:${G.footerSize}px;font-size:${G.footerSize}px;font-weight:400;line-height:1;color:${palette.text}}
.xhs-account{position:absolute;left:0;bottom:0;opacity:.45}.xhs-page-number{position:absolute;right:0;bottom:0;opacity:.35}
.xhs-measure{position:absolute;left:-20000px;top:0;width:${G.contentWidth}px;visibility:hidden;display:flex;flex-direction:column}
`;
}

export function renderInline(doc: Document, inlines: Inline[]): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  for (const inline of inlines) {
    if (inline.type === "text") { fragment.append(doc.createTextNode(inline.text)); continue; }
    const span = doc.createElement("span");
    span.className = `xhs-${inline.type}`;
    span.append(renderInline(doc, inline.children));
    fragment.append(span);
  }
  return fragment;
}

export function renderBlock(doc: Document, block: Block): HTMLElement {
  if (block.type === "image" || block.type === "image-pair") {
    const div = doc.createElement("div"); div.className = `xhs-block xhs-${block.type}`;
    const images = block.type === "image" ? [block] : block.images;
    for (const image of images) { const img = doc.createElement("img"); img.src = image.dataUri ?? ""; img.alt = image.alt; div.append(img); }
    return div;
  }
  if (block.type === "spacer") { const div = doc.createElement("div"); div.className = "xhs-block xhs-spacer"; return div; }
  if (block.type === "table") {
    const wrap = doc.createElement("div"); wrap.className = "xhs-block xhs-table-wrap";
    const table = doc.createElement("table"); table.className = "xhs-table";
    const thead = table.createTHead(); const hr = thead.insertRow();
    for (const cell of block.header) { const th = doc.createElement("th"); th.append(renderInline(doc, cell)); hr.append(th); }
    const tbody = table.createTBody();
    for (const row of block.rows) { const tr = tbody.insertRow(); for (const cell of row) { const td = tr.insertCell(); td.append(renderInline(doc, cell)); } }
    wrap.append(table); return wrap;
  }
  if (block.type === "list") {
    const list = doc.createElement(block.ordered ? "ol" : "ul"); list.className = `xhs-block xhs-list${block.continuesNext ? " xhs-continues-next" : ""}`;
    for (const item of block.items) { const li = doc.createElement("li"); li.append(renderInline(doc, item)); list.append(li); }
    return list;
  }
  const tag = block.type === "cover-title" ? "h1" : block.type === "subtitle" ? `h${(block.headingLevel ?? 1) + 1}` : "div";
  const levelClass = block.type === "subtitle" ? ` xhs-subtitle-${block.headingLevel ?? 1}` : "";
  const el = doc.createElement(tag); el.className = `xhs-block xhs-${block.type}${levelClass}${block.continuesNext ? " xhs-continues-next" : ""}`; el.append(renderInline(doc, block.inlines)); return el;
}

export function pageDocument(options: ExportOptions, fonts: LoadedFont[], page: Page, index: number, total: number): string {
  const css = getRenderCss(options, fonts);
  const doc = document.implementation.createHTMLDocument("");
  const content = doc.createElement("div"); content.className = "xhs-content";
  for (const block of page.blocks) content.append(renderBlock(doc, block));
  const account = escapeHtml(options.account.startsWith("@") ? options.account : `@${options.account}`);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="xhs-card">${content.outerHTML}<div class="xhs-footer"><span class="xhs-account">${account}</span><span class="xhs-page-number">${index + 1}/${total}</span></div></div></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
