import { App, normalizePath, Platform } from "obsidian";
import { domToPng } from "modern-screenshot";
import { GEOMETRY as G } from "./presets";
import { pageDocument } from "./render";
import type { ExportOptions, MotionBlock, Page } from "./types";
import type { LoadedFont } from "./fonts";
import { ensureVaultFolder, writeVaultBinary } from "./vault-utils";
import type { ExportDestination } from "./export-location";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { exportMacLivePhoto, exportMotionOriginal, importPagesToPhotos, type MotionRect, type PhotosPageResource } from "./motion-export";

export type MixedExportSummary = {
  pngCount: number;
  livePhotoCount: number;
  motionOriginalCount: number;
  photosAlbumName?: string;
};

export async function exportPages(
  app: App,
  pages: Page[],
  options: ExportOptions,
  fonts: LoadedFont[],
  destination: ExportDestination,
  onProgress: (current: number, total: number) => void
): Promise<void> {
  const dir = destination.kind === "vault" ? normalizePath(destination.directory) : destination.directory;
  if (destination.kind === "vault") await ensureVaultFolder(app, dir);
  else await mkdir(dir, { recursive: true });
  const digits = Math.max(2, String(pages.length).length);
  for (let index = 0; index < pages.length; index++) {
    onProgress(index + 1, pages.length);
    const binary = await renderPagePng(pages[index]!, index, pages.length, options, fonts);
    const filename = `${String(index + 1).padStart(digits, "0")}.png`;
    if (destination.kind === "vault") {
      await writeVaultBinary(app, normalizePath(`${dir}/${filename}`), binary);
    } else {
      await writeFile(path.join(dir, filename), new Uint8Array(binary));
    }
  }
}

export async function exportMixedPages(
  app: App,
  pages: Page[],
  options: ExportOptions,
  fonts: LoadedFont[],
  destination: ExportDestination,
  noteName: string,
  onProgress: (current: number, total: number, kind: "png" | "live-photo" | "motion-original" | "photos-import") => void
): Promise<MixedExportSummary> {
  const dir = destination.kind === "vault" ? normalizePath(destination.directory) : destination.directory;
  if (destination.kind === "vault") await ensureVaultFolder(app, dir);
  else await mkdir(dir, { recursive: true });
  const digits = Math.max(2, String(pages.length).length);
  const summary: MixedExportSummary = { pngCount: 0, livePhotoCount: 0, motionOriginalCount: 0 };
  const hasLivePhotos = Platform.isMacOS && pages.some((page) => page.blocks.some((block) => block.type === "motion"));
  const photosResources: PhotosPageResource[] = [];

  for (let index = 0; index < pages.length; index++) {
    const page = pages[index]!;
    const prefix = String(index + 1).padStart(digits, "0");
    const snapshot = await renderPageSnapshot(page, index, pages.length, options, fonts);
    const motion = page.blocks.find((block): block is MotionBlock => block.type === "motion");
    if (motion && Platform.isMacOS) {
      if (!motion.filePath || !snapshot.motionRect) throw new Error(`第 ${index + 1} 页的动态素材不可用`);
      onProgress(index + 1, pages.length, "live-photo");
      const pair = await exportMacLivePhoto(snapshot.png, motion.filePath, destination.fullPath, prefix, snapshot.motionRect);
      photosResources.push({ kind: "live-photo", photoPath: pair.photoPath, videoPath: pair.videoPath });
      summary.livePhotoCount++;
      continue;
    }

    onProgress(index + 1, pages.length, motion ? "motion-original" : "png");
    const filename = `${prefix}.png`;
    if (destination.kind === "vault") {
      await writeVaultBinary(app, normalizePath(`${dir}/${filename}`), snapshot.png);
    } else {
      await writeFile(path.join(dir, filename), new Uint8Array(snapshot.png));
    }
    summary.pngCount++;
    if (hasLivePhotos) photosResources.push({ kind: "photo", path: path.join(destination.fullPath, filename) });
    if (motion) {
      if (!motion.filePath) throw new Error(`第 ${index + 1} 页的动态素材不可用`);
      await exportMotionOriginal(motion.filePath, destination.fullPath, `${prefix}-motion.${motion.format}`);
      summary.motionOriginalCount++;
    }
  }
  if (hasLivePhotos) {
    const albumName = photosAlbumName(noteName);
    await importPagesToPhotos(photosResources, albumName, (current, total) => onProgress(current, total, "photos-import"));
    summary.photosAlbumName = albumName;
  }
  return summary;
}

export function photosAlbumName(noteName: string, date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const timestamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}.${pad(date.getMinutes())}.${pad(date.getSeconds())}`;
  const cleanName = noteName.replace(/[\r\n\t]/g, " ").trim() || "未命名";
  return `小红书 · ${cleanName} · ${timestamp}`;
}

export async function renderPagePng(
  page: Page,
  index: number,
  total: number,
  options: ExportOptions,
  fonts: LoadedFont[]
): Promise<ArrayBuffer> {
  return (await renderPageSnapshot(page, index, total, options, fonts)).png;
}

export async function renderPageSnapshot(
  page: Page,
  index: number,
  total: number,
  options: ExportOptions,
  fonts: LoadedFont[]
): Promise<{ png: ArrayBuffer; motionRect?: MotionRect }> {
  const iframe = await mountPage(pageDocument(options, fonts, page, index, total));
  try {
    const doc = iframe.contentDocument!;
    await doc.fonts.ready;
    await Promise.all(Array.from(doc.images).map(async (image) => {
      if (!image.complete) await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error(`图片加载失败：${image.alt}`)); });
      if (typeof image.decode === "function") await image.decode();
    }));
    await Promise.all(Array.from(doc.querySelectorAll("video")).map(prepareVideo));
    const card = doc.querySelector<HTMLElement>(".xhs-card");
    if (!card) throw new Error("找不到待导出的卡片");
    const motion = card.querySelector<HTMLElement>(".xhs-motion");
    let motionRect: MotionRect | undefined;
    if (motion) {
      const cardRect = card.getBoundingClientRect();
      const rect = motion.getBoundingClientRect();
      motionRect = {
        x: Math.round(rect.left - cardRect.left),
        y: Math.round(rect.top - cardRect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    }
    const dataUrl = await domToPng(card, { width: G.width, height: G.height, scale: 1 });
    return { png: dataUrlToArrayBuffer(dataUrl), motionRect };
  } finally { iframe.remove(); }
}

async function prepareVideo(video: HTMLVideoElement): Promise<void> {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener("loadeddata", () => resolve(), { once: true });
      video.addEventListener("error", () => reject(new Error("动态视频加载失败")), { once: true });
    });
  }
  if (!Number.isFinite(video.duration) || video.duration <= 0) return;
  const target = Math.min(Math.max(video.duration / 2, 0), Math.max(0, video.duration - 0.05));
  if (Math.abs(video.currentTime - target) < 0.01) return;
  await new Promise<void>((resolve) => {
    video.addEventListener("seeked", () => resolve(), { once: true });
    video.currentTime = target;
  });
}

async function mountPage(srcdoc: string): Promise<HTMLIFrameElement> {
  const iframe = document.body.createEl("iframe");
  iframe.style.cssText = `position:fixed;left:-20000px;top:0;width:${G.width}px;height:${G.height}px;border:0;opacity:0;pointer-events:none`;
  const ready = new Promise<void>((resolve) => {
    const loaded = () => {
      if (!iframe.contentDocument?.querySelector(".xhs-card")) return;
      iframe.removeEventListener("load", loaded); resolve();
    };
    iframe.addEventListener("load", loaded);
    iframe.srcdoc = srcdoc;
  });
  await ready;
  return iframe;
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
