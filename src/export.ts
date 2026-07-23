import { App, normalizePath } from "obsidian";
import { domToPng } from "modern-screenshot";
import { GEOMETRY as G } from "./presets";
import { pageDocument } from "./render";
import type { ExportOptions, Page } from "./types";
import type { LoadedFont } from "./fonts";
import { ensureVaultFolder, writeVaultBinary } from "./vault-utils";
import type { ExportDestination } from "./export-location";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

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
    const iframe = await mountPage(pageDocument(options, fonts, pages[index]!, index, pages.length));
    try {
      const doc = iframe.contentDocument!;
      await doc.fonts.ready;
      await Promise.all(Array.from(doc.images).map(async (image) => {
        if (!image.complete) await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error(`图片加载失败：${image.alt}`)); });
        if (typeof image.decode === "function") await image.decode();
      }));
      const card = doc.querySelector<HTMLElement>(".xhs-card");
      if (!card) throw new Error("找不到待导出的卡片");
      const dataUrl = await domToPng(card, { width: G.width, height: G.height, scale: 1 });
      const binary = dataUrlToArrayBuffer(dataUrl);
      const filename = `${String(index + 1).padStart(digits, "0")}.png`;
      if (destination.kind === "vault") {
        await writeVaultBinary(app, normalizePath(`${dir}/${filename}`), binary);
      } else {
        await writeFile(path.join(dir, filename), new Uint8Array(binary));
      }
    } finally { iframe.remove(); }
  }
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
