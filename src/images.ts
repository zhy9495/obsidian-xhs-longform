import { App, FileSystemAdapter, TFile } from "obsidian";
import type { Block, ImageBlock, MotionBlock } from "./types";

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
  const resolveMotion = async (motion: MotionBlock): Promise<MotionBlock> => {
    const file = resolveFile(app, motion.link, sourcePath);
    const adapter = app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) throw new Error("动态素材导出仅支持本地桌面仓库");
    return {
      ...motion,
      resourceUrl: app.vault.getResourcePath(file),
      filePath: adapter.getFullPath(file.path)
    };
  };
  return Promise.all(blocks.map(async (block) => {
    if (block.type === "image") return resolve(block);
    if (block.type === "image-pair") return { ...block, images: [await resolve(block.images[0]), await resolve(block.images[1])] };
    if (block.type === "motion") return resolveMotion(block);
    return block;
  }));
}

function resolveFile(app: App, link: string, sourcePath: string): TFile {
  const rawLink = link.split("#")[0]!.split("?")[0]!;
  let cleanLink = rawLink;
  try { cleanLink = decodeURIComponent(rawLink); } catch { /* Keep malformed percent escapes literal. */ }
  const file = app.metadataCache.getFirstLinkpathDest(cleanLink, sourcePath);
  if (!(file instanceof TFile)) throw new Error(`找不到素材：${link}`);
  return file;
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
