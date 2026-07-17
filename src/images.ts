import { App, TFile } from "obsidian";
import type { Block, ImageBlock } from "./types";

export async function resolveImages(app: App, blocks: Block[], sourcePath: string): Promise<Block[]> {
  const cache = new Map<string, string>();
  const resolve = async (image: ImageBlock): Promise<ImageBlock> => {
    const previous = cache.get(image.link);
    if (previous) return { ...image, dataUri: previous };
    const rawLink = image.link.split("#")[0]!.split("?")[0]!;
    let cleanLink = rawLink;
    try { cleanLink = decodeURIComponent(rawLink); } catch { /* Keep malformed percent escapes literal. */ }
    const file = app.metadataCache.getFirstLinkpathDest(cleanLink, sourcePath);
    if (!(file instanceof TFile)) throw new Error(`找不到图片：${image.link}`);
    const bytes = new Uint8Array(await app.vault.readBinary(file));
    const mime = mimeFor(file.extension);
    const dataUri = `data:${mime};base64,${bytesToBase64(bytes)}`;
    cache.set(image.link, dataUri);
    return { ...image, dataUri };
  };
  return Promise.all(blocks.map(async (block) => {
    if (block.type === "image") return resolve(block);
    if (block.type === "image-pair") return { ...block, images: [await resolve(block.images[0]), await resolve(block.images[1])] };
    return block;
  }));
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  return btoa(binary);
}

function mimeFor(extension: string): string {
  return ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif" } as Record<string, string>)[extension.toLowerCase()] ?? "application/octet-stream";
}
