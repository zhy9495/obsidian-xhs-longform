import type { Block, ImageBlock, Inline, MotionBlock } from "./types";

const imageWiki = /^!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/;
const imageMarkdown = /^!\[([^\]]*)\]\(([^)]+)\)$/;
const tableSeparator = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/;

export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => { if (text) { out.push({ type: "text", text }); text = ""; } };

  for (let i = 0; i < source.length;) {
    const rest = source.slice(i);
    const link = rest.match(/^\[([^\]]+)\]\([^)]+\)/);
    if (link) { flush(); out.push(...parseInline(link[1]!)); i += link[0].length; continue; }

    const forms: Array<[string, "bold" | "highlight" | "code" | "italic"]> = [
      ["**", "bold"], ["==", "highlight"], ["`", "code"], ["*", "italic"]
    ];
    let matched = false;
    for (const [mark, type] of forms) {
      if (!rest.startsWith(mark)) continue;
      const end = source.indexOf(mark, i + mark.length);
      if (end < 0 || end === i + mark.length) continue;
      flush();
      const inner = source.slice(i + mark.length, end);
      out.push({ type, children: type === "code" ? [{ type: "text", text: inner }] : parseInline(inner) });
      i = end + mark.length;
      matched = true;
      break;
    }
    if (!matched) { text += source[i]; i++; }
  }
  flush();
  return mergeText(out);
}

function mergeText(inlines: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const inline of inlines) {
    const last = out.at(-1);
    if (inline.type === "text" && last?.type === "text") last.text += inline.text;
    else out.push(inline);
  }
  return out;
}

function splitTableRow(line: string): Inline[][] {
  let value = line.trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|")) value = value.slice(0, -1);
  return value.split(/(?<!\\)\|/).map((cell) => parseInline(cell.trim().replace(/\\\|/g, "|")));
}

type ParsedAttachment =
  | Omit<ImageBlock, "type"> & { type: "image" }
  | Omit<MotionBlock, "type" | "id"> & { type: "motion" };

function parseAttachment(line: string): ParsedAttachment | null {
  const wiki = line.trim().match(imageWiki);
  if (wiki) return attachmentFor(wiki[1]!.trim(), (wiki[2] ?? wiki[1])!.trim());
  const markdown = line.trim().match(imageMarkdown);
  if (markdown) return attachmentFor(markdown[2]!.trim().replace(/^<|>$/g, ""), markdown[1]!.trim());
  return null;
}

function attachmentFor(link: string, alt: string): ParsedAttachment {
  const clean = link.split("#")[0]!.split("?")[0]!;
  const extension = clean.split(".").at(-1)?.toLowerCase();
  if (extension === "gif" || extension === "mp4" || extension === "mov") {
    return { type: "motion", link, alt, format: extension };
  }
  return { type: "image", link, alt };
}

export function parseMarkdown(markdown: string, documentTitle?: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const raw: Block[] = [];
  let motionIndex = 0;

  for (let i = 0; i < lines.length;) {
    const line = lines[i]!;
    if (!line.trim()) {
      while (i < lines.length && !lines[i]!.trim()) i++;
      raw.push({ type: "spacer" });
      continue;
    }
    if (/^\s*---+\s*$/.test(line)) { i++; continue; }

    if (/^\s*```/.test(line)) {
      const content: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i]!)) content.push(lines[i++]!);
      if (i < lines.length) i++;
      raw.push({ type: "code-block", inlines: [{ type: "text", text: content.join("\n") }] });
      continue;
    }

    const attachment = parseAttachment(line);
    if (attachment) {
      raw.push(attachment.type === "motion"
        ? { ...attachment, id: `motion-${++motionIndex}` }
        : attachment);
      i++; continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      raw.push({ type: "subtitle", headingLevel: heading[1]!.length as 1 | 2 | 3, inlines: parseInline(heading[2]!.trim()) });
      i++; continue;
    }

    if (line.includes("|") && i + 1 < lines.length && tableSeparator.test(lines[i + 1]!)) {
      const header = splitTableRow(line);
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && lines[i]!.includes("|") && lines[i]!.trim()) rows.push(splitTableRow(lines[i++]!));
      raw.push({ type: "table", header, rows });
      continue;
    }

    const listMatch = line.match(/^\s{0,4}([-*]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[1]!);
      const items: Inline[][] = [];
      while (i < lines.length) {
        const item = lines[i]!.match(/^\s{0,8}([-*]|\d+\.)\s+(.*)$/);
        if (!item || /\d+\./.test(item[1]!) !== ordered) break;
        items.push(parseInline(item[2]!)); i++;
      }
      raw.push({ type: "list", ordered, items });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const parts: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!)) parts.push(lines[i++]!.replace(/^>\s?/, ""));
      raw.push({ type: "quote", inlines: parseInline(parts.join(" ")) });
      continue;
    }

    const paragraph: string[] = [line.trim()];
    i++;
    while (i < lines.length && lines[i]!.trim() && !startsBlock(lines, i)) paragraph.push(lines[i++]!.trim());
    raw.push({ type: "paragraph", inlines: parseInline(paragraph.join(" ")) });
  }
  const blocks = pairImages(raw).filter((block, index, all) => block.type !== "spacer" || (index > 0 && index < all.length - 1));
  return documentTitle?.trim()
    ? [{ type: "cover-title", inlines: parseInline(documentTitle.trim()) }, ...blocks]
    : blocks;
}

function startsBlock(lines: string[], index: number): boolean {
  const line = lines[index]!;
  return /^#{1,3}\s+|^\s*```|^\s*---+\s*$|^>\s?|^\s{0,4}(?:[-*]|\d+\.)\s+/.test(line)
    || Boolean(parseAttachment(line))
    || (line.includes("|") && index + 1 < lines.length && tableSeparator.test(lines[index + 1]!));
}

function pairImages(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (let i = 0; i < blocks.length;) {
    if (blocks[i]?.type !== "image") { out.push(blocks[i++]!); continue; }
    const images: ImageBlock[] = [];
    while (i < blocks.length) {
      if (blocks[i]?.type === "image") { images.push(blocks[i] as ImageBlock); i++; continue; }
      if (blocks[i]?.type === "spacer" && blocks[i + 1]?.type === "image") { i++; continue; }
      break;
    }
    for (let j = 0; j < images.length; j += 2) {
      if (images[j + 1]) out.push({ type: "image-pair", images: [images[j]!, images[j + 1]!] });
      else out.push(images[j]!);
    }
  }
  return out;
}
