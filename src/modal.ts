import { App, ButtonComponent, Modal, Notice, Setting, TFile } from "obsidian";
import type XhsLongformPlugin from "./main";
import { PALETTES, SIZE_SCALES } from "./presets";
import { parseMarkdown } from "./parser";
import { resolveImages } from "./images";
import { LayoutMeasurer } from "./measure";
import { paginate } from "./paginate";
import { exportPages } from "./export";
import { pageDocument } from "./render";
import type { ExportOptions, Page, SizeScale, StyleId, TextureId } from "./types";

export class ExportModal extends Modal {
  private options: ExportOptions;
  private pages: Page[] | null = null;
  private previewEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private previewButton: ButtonComponent | null = null;
  private exportButton: ButtonComponent | null = null;
  private busy = false;

  constructor(app: App, private plugin: XhsLongformPlugin, private file: TFile) {
    super(app);
    const settings = plugin.settings;
    this.options = {
      account: settings.account, style: settings.style, paletteId: settings.paletteId, fontId: settings.fontId, texture: settings.texture,
      titleScale: settings.titleScale, subtitleScale: settings.subtitleScale, bodyScale: settings.bodyScale
    };
  }

  onOpen(): void {
    this.modalEl.addClass("xhs-export-modal");
    this.contentEl.createEl("h2", { text: "导出为小红书图片" });
    const controls = this.contentEl.createDiv({ cls: "xhs-export-controls" });
    this.renderControls(controls);
    const actions = this.contentEl.createDiv({ cls: "xhs-export-actions" });
    this.previewButton = new ButtonComponent(actions).setButtonText("预览").onClick(() => void this.preview());
    this.exportButton = new ButtonComponent(actions).setButtonText("导出 PNG").setCta().onClick(() => void this.export());
    this.statusEl = actions.createSpan({ cls: "xhs-export-progress", text: "尚未生成预览" });
    this.previewEl = this.contentEl.createDiv({ cls: "xhs-preview-strip" });
  }

  private renderControls(container: HTMLElement): void {
    new Setting(container).setName("账号名").addText((text) => text.setPlaceholder("必填，例如 ying").setValue(this.options.account).onChange((value) => { this.options.account = value.trim(); this.invalidate(); }));
    new Setting(container).setName("风格").addDropdown((dropdown) => dropdown.addOption("pingfang", "简约黑体").addOption("handwrite", "手写纹理").setValue(this.options.style).onChange((value) => {
      this.options.style = value as StyleId;
      this.options.paletteId = value === "pingfang" ? "paper-white" : "cool-black";
      container.empty(); this.renderControls(container); this.invalidate();
    }));
    new Setting(container).setName("配色").addDropdown((dropdown) => {
      for (const palette of PALETTES.filter((item) => item.style === this.options.style)) dropdown.addOption(palette.id, palette.name);
      return dropdown.setValue(this.options.paletteId).onChange((value) => { this.options.paletteId = value; this.invalidate(); });
    });
    new Setting(container).setName("字体").setDisabled(this.options.style !== "handwrite").addDropdown((dropdown) => {
      for (const font of this.plugin.fonts) dropdown.addOption(font.id, font.available ? font.name : font.source === "downloadable" ? `${font.name}（首次使用时下载）` : `${font.name}（未安装）`);
      for (const option of Array.from(dropdown.selectEl.options)) {
        const font = this.plugin.fonts.find((item) => item.id === option.value);
        option.disabled = Boolean(font && !font.available && font.source !== "downloadable");
      }
      return dropdown.setValue(this.options.fontId).onChange((value) => { this.options.fontId = value; this.invalidate(); });
    });
    new Setting(container).setName("纹理").setDisabled(this.options.style !== "handwrite").addDropdown((dropdown) => dropdown
      .addOption("auto", "跟随配色推荐").addOption("none", "无纹理").addOption("grid", "格子纸").addOption("dot", "圆点纸").addOption("line", "横线纸")
      .setValue(this.options.texture).onChange((value) => { this.options.texture = value as TextureId; this.invalidate(); }));
    this.addSizeControl(container, "标题字号", this.options.titleScale, (value) => { this.options.titleScale = value; });
    this.addSizeControl(container, "小标题字号", this.options.subtitleScale, (value) => { this.options.subtitleScale = value; });
    this.addSizeControl(container, "正文字号", this.options.bodyScale, (value) => { this.options.bodyScale = value; });
  }

  private addSizeControl(container: HTMLElement, name: string, value: SizeScale, update: (value: SizeScale) => void): void {
    new Setting(container).setName(name).addDropdown((dropdown) => {
      for (const option of SIZE_SCALES) dropdown.addOption(option.id, option.name);
      return dropdown.setValue(value).onChange((next) => { update(next as SizeScale); this.invalidate(); });
    });
  }

  private invalidate(): void { this.pages = null; if (this.statusEl) this.statusEl.textContent = "设置已改变，请重新预览"; }

  private validate(): boolean {
    if (!this.options.account.trim()) { new Notice("请先填写账号名"); return false; }
    const font = this.plugin.fonts.find((item) => item.id === this.options.fontId);
    if (this.options.style === "handwrite" && (!font || (!font.available && font.source !== "downloadable"))) {
      new Notice("所选手写字体未安装，请换一个字体"); return false;
    }
    return true;
  }

  private async buildPages(): Promise<Page[]> {
    const font = this.plugin.fonts.find((item) => item.id === this.options.fontId);
    if (this.options.style === "handwrite" && font?.source === "downloadable" && !font.available) {
      if (this.statusEl) this.statusEl.textContent = `正在下载并校验 ${font.name}…`;
      await this.plugin.ensureFontAvailable(font.id);
    }
    const markdown = await this.app.vault.cachedRead(this.file);
    const blocks = await resolveImages(this.app, parseMarkdown(markdown, this.file.basename), this.file.path);
    const measurer = new LayoutMeasurer();
    await measurer.init(this.options, this.plugin.fonts);
    try { return paginate(blocks, measurer); }
    finally { measurer.destroy(); }
  }

  private async preview(): Promise<void> {
    if (!this.validate() || this.busy) return;
    this.setBusy(true, "正在排版…");
    try {
      this.pages = await this.buildPages();
      this.previewEl!.empty();
      for (let index = 0; index < this.pages.length; index++) {
        const frame = this.previewEl!.createDiv({ cls: "xhs-preview-frame" }).createEl("iframe");
        frame.srcdoc = pageDocument(this.options, this.plugin.fonts, this.pages[index]!, index, this.pages.length);
        frame.title = `第 ${index + 1} 页预览`;
      }
      this.statusEl!.textContent = `共 ${this.pages.length} 页`;
    } catch (error) { this.reportError(error); }
    finally { this.setBusy(false); }
  }

  private async export(): Promise<void> {
    if (!this.validate() || this.busy) return;
    this.setBusy(true, "正在准备…");
    try {
      if (!this.pages) this.pages = await this.buildPages();
      const title = this.file.basename.replace(/[\\/:*?"<>|]/g, "-");
      const outputDir = (this.plugin.settings.outputDir || "xhs-export/{{title}}").replaceAll("{{title}}", title);
      await exportPages(this.app, this.pages, this.options, this.plugin.fonts, outputDir, (current, total) => {
        if (this.statusEl) this.statusEl.textContent = `正在导出 ${current}/${total}…`;
      });
      this.statusEl!.textContent = `已导出 ${this.pages.length} 张到 ${outputDir}`;
      new Notice(`已导出 ${this.pages.length} 张到 ${outputDir}`);
    } catch (error) { this.reportError(error); }
    finally { this.setBusy(false); }
  }

  private setBusy(busy: boolean, status?: string): void {
    this.busy = busy; this.previewButton?.setDisabled(busy); this.exportButton?.setDisabled(busy);
    if (status && this.statusEl) this.statusEl.textContent = status;
  }

  private reportError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    if (this.statusEl) this.statusEl.textContent = `失败：${message}`;
    new Notice(`xhs-longform：${message}`, 8000);
    console.error("xhs-longform", error);
  }
}
