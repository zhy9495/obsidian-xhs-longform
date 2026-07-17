import { Menu, Plugin, TFile, normalizePath } from "obsidian";
import { DEFAULT_SETTINGS, XhsLongformSettingTab, type XhsLongformSettings } from "./settings";
import { CUSTOM_FONT_DIR, fallbackHandwritingFontId, loadedDownloadableFont, loadHandwritingFonts, type CustomFontConfig, type LoadedFont } from "./fonts";
import { downloadableFontById } from "./downloadable-fonts";
import { FontAssetCache } from "./font-cache";
import { fontFormatForFilename } from "./font-formats";
import { ExportModal } from "./modal";
import { ensureVaultFolder } from "./vault-utils";

export default class XhsLongformPlugin extends Plugin {
  settings: XhsLongformSettings = { ...DEFAULT_SETTINGS };
  fonts: LoadedFont[] = [];
  private fontCache = new FontAssetCache();
  private fontDownloads = new Map<string, Promise<void>>();

  async onload(): Promise<void> {
    await this.loadSettings();
    await this.reloadFonts();
    const selectedFont = this.fonts.find((font) => font.id === this.settings.fontId);
    if (!selectedFont || (!selectedFont.available && selectedFont.source !== "downloadable")) {
      this.settings.fontId = fallbackHandwritingFontId(this.fonts);
      await this.saveSettings();
    }
    this.addCommand({
      id: "export-current-note-as-xhs-images",
      name: "导出当前笔记为小红书图片",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const available = file instanceof TFile && file.extension === "md";
        if (!checking && available) new ExportModal(this.app, this, file).open();
        return available;
      }
    });
    this.registerEvent(this.app.workspace.on("file-menu", (menu: Menu, file) => {
      if (!(file instanceof TFile) || file.extension !== "md") return;
      menu.addItem((item) => item.setTitle("导出为小红书图片").setIcon("images").onClick(() => new ExportModal(this.app, this, file).open()));
    }));
    this.addSettingTab(new XhsLongformSettingTab(this.app, this));
  }

  onunload(): void { this.fontCache.dispose(); }

  async loadSettings(): Promise<void> {
    const saved: unknown = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS };
    if (saved && typeof saved === "object") Object.assign(this.settings, saved);
    if (!Array.isArray(this.settings.customFonts)) this.settings.customFonts = [];
  }
  async saveSettings(): Promise<void> { await this.saveData(this.settings); }

  async reloadFonts(): Promise<void> {
    this.fonts = await loadHandwritingFonts(this.app, this.settings.customFonts, this.fontCache);
  }

  async ensureFontAvailable(id: string): Promise<void> {
    if (this.fonts.find((font) => font.id === id)?.available) return;
    const existing = this.fontDownloads.get(id);
    if (existing) return existing;
    const definition = downloadableFontById(id);
    if (!definition) throw new Error("所选字体在本机不可用");
    const download = this.fontCache.download(definition).then((url) => {
      const loaded = loadedDownloadableFont(definition, url);
      this.fonts = this.fonts.map((font) => font.id === id ? loaded : font);
    }).finally(() => { this.fontDownloads.delete(id); });
    this.fontDownloads.set(id, download);
    return download;
  }

  async clearDownloadedFonts(): Promise<void> {
    await this.fontCache.clear();
    await this.reloadFonts();
  }

  async importCustomFont(file: File): Promise<void> {
    const format = fontFormatForFilename(file.name);
    if (!format) throw new Error("仅支持 TTF、OTF、WOFF 和 WOFF2 字体");
    if (file.size === 0) throw new Error("字体文件为空");
    if (file.size > 30 * 1024 * 1024) throw new Error("字体文件不能超过 30 MB");
    const data = await file.arrayBuffer();
    try { await new FontFace("XhsFontValidation", data).load(); }
    catch { throw new Error("无法识别该字体文件，文件可能损坏或格式不受支持"); }
    await ensureVaultFolder(this.app, CUSTOM_FONT_DIR);
    const id = `custom-${crypto.randomUUID()}`;
    const extension = file.name.split(".").at(-1)!.toLowerCase();
    const path = normalizePath(`${CUSTOM_FONT_DIR}/${id}.${extension}`);
    await this.app.vault.createBinary(path, data);
    const config: CustomFontConfig = { id, name: file.name.replace(/\.[^.]+$/, ""), path, format };
    this.settings.customFonts.push(config);
    this.settings.fontId = id;
    await this.saveSettings();
    await this.reloadFonts();
  }

  async removeCustomFont(id: string): Promise<void> {
    const config = this.settings.customFonts.find((font) => font.id === id);
    if (!config) return;
    const file = this.app.vault.getAbstractFileByPath(normalizePath(config.path));
    if (file) await this.app.fileManager.trashFile(file);
    this.settings.customFonts = this.settings.customFonts.filter((font) => font.id !== id);
    if (this.settings.fontId === id) this.settings.fontId = fallbackHandwritingFontId(this.fonts);
    await this.saveSettings();
    await this.reloadFonts();
  }
}
