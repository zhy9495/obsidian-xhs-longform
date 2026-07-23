import { App, ButtonComponent, FileSystemAdapter, Modal, Notice, Platform, Setting, TFile } from "obsidian";
import type XhsLongformPlugin from "./main";
import { AVATAR_SIZES, fontSizeOptions, PAGE_MARGINS, PALETTES, type TypographyRole } from "./presets";
import { parseMarkdown } from "./parser";
import { resolveImages } from "./images";
import { LayoutMeasurer } from "./measure";
import { paginate } from "./paginate";
import { exportMixedPages } from "./export";
import { pageDocument } from "./render";
import type { AvatarSize, ExportOptions, Page, PageMargin, SizeScale, StyleId, TextureId } from "./types";
import { addCoverAuthor, authorTextVisible, limitAuthorSubtitle } from "./cover";
import { chooseComputerFolder, openComputerFolder } from "./desktop";
import { resolveComputerDirectory, resolveVaultDirectory, type ExportDestination, type OutputLocationMode } from "./export-location";

export class ExportModal extends Modal {
  private options: ExportOptions;
  private pages: Page[] | null = null;
  private previewEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private previewButton: ButtonComponent | null = null;
  private exportButton: ButtonComponent | null = null;
  private openFolderButton: ButtonComponent | null = null;
  private lastExportDirectory = "";
  private busy = false;
  private previewTimer: number | null = null;

  constructor(app: App, private plugin: XhsLongformPlugin, private file: TFile) {
    super(app);
    const settings = plugin.settings;
    this.options = {
      account: settings.account, style: settings.style, paletteId: settings.paletteId, fontId: settings.fontId, texture: settings.texture,
      titleScale: settings.titleScale, subtitleScale: settings.subtitleScale, bodyScale: settings.bodyScale,
      horizontalMargin: settings.horizontalMargin, topMargin: settings.topMargin,
      showAvatar: settings.showAvatar, showTitle: settings.showTitle, avatarDataUrl: settings.avatarDataUrl, avatarSize: settings.avatarSize,
      authorSubtitle: settings.authorSubtitle, coverImageDataUrl: settings.coverImageDataUrl,
      showCoverImage: settings.showCoverImage
    };
  }

  onOpen(): void {
    this.modalEl.addClass("xhs-export-modal");
    this.contentEl.createEl("h2", { text: "导出为小红书图片" });
    const workspace = this.contentEl.createDiv({ cls: "xhs-export-workspace" });
    const sidebar = workspace.createDiv({ cls: "xhs-export-sidebar" });
    const controls = sidebar.createDiv({ cls: "xhs-export-controls" });
    this.renderControls(controls);
    const actions = sidebar.createDiv({ cls: "xhs-export-actions" });
    this.previewButton = new ButtonComponent(actions).setButtonText("刷新预览").onClick(() => void this.preview());
    this.exportButton = new ButtonComponent(actions).setButtonText("导出").setCta().onClick(() => void this.export());
    this.openFolderButton = new ButtonComponent(actions).setButtonText("打开文件夹").onClick(() => void this.openLastExportFolder());
    this.openFolderButton.buttonEl.hidden = true;
    this.statusEl = sidebar.createDiv({ cls: "xhs-export-progress", text: "正在生成预览…" });
    const previewPanel = workspace.createDiv({ cls: "xhs-preview-panel" });
    previewPanel.createDiv({ cls: "xhs-preview-heading", text: "实时预览" });
    this.previewEl = previewPanel.createDiv({ cls: "xhs-preview-strip" });
    this.schedulePreview(0);
  }

  onClose(): void {
    if (this.previewTimer !== null) window.clearTimeout(this.previewTimer);
  }

  private renderControls(container: HTMLElement): void {
    this.addSection(container, "固定信息");
    new Setting(container).setName("底部昵称").setDesc("每一页固定显示，页码也会始终显示。")
      .addText((text) => text.setPlaceholder("必填，例如 ying").setValue(this.options.account).onChange((value) => { this.options.account = value.trim(); this.invalidate(); }));
    this.addSection(container, "封面内容");
    new Setting(container).setName("显示顶部封面图").setDesc("开启后才显示图片上传选项。").addToggle((toggle) => toggle.setValue(this.options.showCoverImage).onChange((value) => {
      this.options.showCoverImage = value; container.empty(); this.renderControls(container); this.invalidate();
    }));
    if (this.options.showCoverImage) this.renderCoverImageControl(container);
    new Setting(container).setName("显示头像").setDesc(this.options.showCoverImage ? "叠在封面图与底图的分割线上。" : "与昵称一起显示在第一页顶部。").addToggle((toggle) => toggle.setValue(this.options.showAvatar).onChange((value) => {
      this.options.showAvatar = value; container.empty(); this.renderControls(container); this.invalidate();
    }));
    if (this.options.showAvatar) {
      this.renderAvatarControl(container);
      new Setting(container).setName("头像区域大小").setDesc("同时调整头像和周围间距。").addDropdown((dropdown) => {
        for (const option of AVATAR_SIZES) dropdown.addOption(option.id, option.name);
        return dropdown.setValue(this.options.avatarSize).onChange((value) => { this.options.avatarSize = value as AvatarSize; this.invalidate(); });
      });
    }
    if (this.options.showAvatar && !this.options.showCoverImage) {
      new Setting(container).setName("昵称下方文字").setDesc("可填写日期、账号或任意一句话，最多 15 个字；留空时昵称垂直居中。")
        .addText((text) => {
          return text.setPlaceholder("选填，最多 15 个字").setValue(this.options.authorSubtitle).onChange((value) => {
            const limited = limitAuthorSubtitle(value); if (limited !== value) text.setValue(limited);
            this.options.authorSubtitle = limited; this.invalidate();
          });
        });
    }
    new Setting(container).setName("显示标题").setDesc("标题取当前笔记文件名；关闭后直接从正文开始。").addToggle((toggle) => toggle.setValue(this.options.showTitle).onChange((value) => {
      this.options.showTitle = value; this.invalidate();
    }));
    this.addSection(container, "视觉样式");
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
    this.addSection(container, "文字与页面");
    this.addSizeControl(container, "标题字号", "title", this.options.titleScale, (value) => { this.options.titleScale = value; });
    this.addSizeControl(container, "小标题字号", "subtitle", this.options.subtitleScale, (value) => { this.options.subtitleScale = value; });
    this.addSizeControl(container, "正文字号", "body", this.options.bodyScale, (value) => { this.options.bodyScale = value; });
    this.addMarginControl(container, "左右边距", this.options.horizontalMargin, (value) => { this.options.horizontalMargin = value; });
    this.addMarginControl(container, "顶部边距", this.options.topMargin, (value) => { this.options.topMargin = value; });
    this.addSection(container, "导出位置");
    new Setting(container).setName("保存到").addDropdown((dropdown) => dropdown
      .addOption("vault", "当前 Obsidian 仓库")
      .addOption("computer", "电脑文件夹")
      .setValue(this.plugin.settings.outputLocationMode)
      .onChange(async (value) => {
        this.plugin.settings.outputLocationMode = value as OutputLocationMode;
        await this.plugin.saveSettings();
        container.empty();
        this.renderControls(container);
      }));
    if (this.plugin.settings.outputLocationMode === "vault") {
      new Setting(container).setName("仓库内目录").setDesc("{{title}} 会替换为当前笔记名。").addText((text) => text
        .setValue(this.plugin.settings.outputDir)
        .onChange(async (value) => {
          this.plugin.settings.outputDir = value || "xhs-export/{{title}}";
          await this.plugin.saveSettings();
        }));
    } else {
      const setting = new Setting(container).setName("电脑文件夹")
        .setDesc(this.plugin.settings.computerOutputDir || "尚未选择；导出时会提示选择。");
      setting.addButton((button) => button.setButtonText(this.plugin.settings.computerOutputDir ? "更换" : "选择").onClick(async () => {
        await this.selectComputerOutputFolder(container);
      }));
      if (this.plugin.settings.computerOutputDir) {
        setting.addExtraButton((button) => button.setIcon("folder-open").setTooltip("打开文件夹").onClick(async () => {
          try { await openComputerFolder(this.plugin.settings.computerOutputDir); }
          catch (error) { this.reportError(error); }
        }));
      }
    }
    this.addSection(container, "自动导出");
    new Setting(container)
      .setName("动态文件")
      .setDesc(Platform.isMacOS
        ? "实况照片仅支持 macOS。只要笔记中含有动态素材，导出后的全部页面都会按顺序加入“照片”App 的新相簿；动态页为实况照片，静态页为普通图片。所选文件夹仍会保留原件备份。"
        : "插件会读取当前笔记中已经嵌入的动态素材。点击“导出”后保存全部 PNG，并同时导出视频或 GIF 原件。");
  }

  private addSection(container: HTMLElement, title: string): void {
    container.createDiv({ cls: "xhs-control-section", text: title });
  }

  private addSizeControl(container: HTMLElement, name: string, role: TypographyRole, value: SizeScale, update: (value: SizeScale) => void): void {
    new Setting(container).setName(name).addDropdown((dropdown) => {
      for (const option of fontSizeOptions(this.options.style, role)) dropdown.addOption(option.id, option.label);
      return dropdown.setValue(value).onChange((next) => { update(next as SizeScale); this.invalidate(); });
    });
  }

  private addMarginControl(container: HTMLElement, name: string, value: PageMargin, update: (value: PageMargin) => void): void {
    new Setting(container).setName(name).addDropdown((dropdown) => {
      for (const option of PAGE_MARGINS) dropdown.addOption(option.id, option.name);
      return dropdown.setValue(value).onChange((next) => { update(next as PageMargin); this.invalidate(); });
    });
  }

  private renderAvatarControl(container: HTMLElement): void {
    const setting = new Setting(container).setName("头像图片").setDesc(this.options.showCoverImage ? "只显示头像，不显示旁边的昵称与自定义文字。" : "头像右侧固定显示底部昵称。");
    if (this.options.avatarDataUrl) {
      const preview = setting.controlEl.createEl("img", { cls: "xhs-avatar-preview", attr: { src: this.options.avatarDataUrl, alt: "当前头像" } });
      preview.setAttribute("aria-hidden", "true");
      setting.addExtraButton((button) => button.setIcon("trash-2").setTooltip("删除头像").onClick(async () => {
        await this.plugin.removeAvatar();
        this.options.avatarDataUrl = ""; this.options.showAvatar = false;
        container.empty(); this.renderControls(container); this.invalidate(); new Notice("已删除封面头像");
      }));
    }
    const input = setting.controlEl.createEl("input", { cls: "xhs-avatar-file-input", attr: { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif" } });
    setting.addButton((button) => button.setButtonText(this.options.avatarDataUrl ? "更换" : "上传").onClick(() => input.click()));
    this.plugin.registerDomEvent(input, "change", () => {
      const file = input.files?.[0]; if (!file) return;
      void this.importAvatar(file, container).finally(() => { input.value = ""; });
    });
  }

  private async importAvatar(file: File, container: HTMLElement): Promise<void> {
    try {
      await this.plugin.importAvatar(file); this.options.avatarDataUrl = this.plugin.settings.avatarDataUrl;
      container.empty(); this.renderControls(container); this.invalidate(); new Notice("头像已保存");
    } catch (error) { new Notice(`头像导入失败：${error instanceof Error ? error.message : String(error)}`, 8000); }
  }

  private renderCoverImageControl(container: HTMLElement): void {
    const setting = new Setting(container).setName("顶部封面图").setDesc(this.options.coverImageDataUrl ? "封面图会铺满第一页上方，可更换或删除。" : "选填；上传后自动裁切为通栏封面图。");
    if (this.options.coverImageDataUrl) {
      setting.controlEl.createEl("img", { cls: "xhs-cover-image-preview", attr: { src: this.options.coverImageDataUrl, alt: "当前封面图" } });
      setting.addExtraButton((button) => button.setIcon("trash-2").setTooltip("删除封面图").onClick(async () => {
        await this.plugin.removeCoverImage(); this.options.coverImageDataUrl = ""; this.options.showCoverImage = false;
        container.empty(); this.renderControls(container); this.invalidate(); new Notice("已删除顶部封面图");
      }));
    }
    const input = setting.controlEl.createEl("input", { cls: "xhs-avatar-file-input", attr: { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif" } });
    setting.addButton((button) => button.setButtonText(this.options.coverImageDataUrl ? "更换" : "上传").onClick(() => input.click()));
    this.plugin.registerDomEvent(input, "change", () => {
      const file = input.files?.[0]; if (!file) return;
      void this.importCoverImage(file, container).finally(() => { input.value = ""; });
    });
  }

  private async importCoverImage(file: File, container: HTMLElement): Promise<void> {
    try {
      await this.plugin.importCoverImage(file); this.options.coverImageDataUrl = this.plugin.settings.coverImageDataUrl;
      container.empty(); this.renderControls(container); this.invalidate(); new Notice("顶部封面图已保存");
    } catch (error) { new Notice(`封面图导入失败：${error instanceof Error ? error.message : String(error)}`, 8000); }
  }

  private invalidate(): void {
    this.pages = null;
    if (this.statusEl) this.statusEl.textContent = "正在更新预览…";
    this.schedulePreview();
  }

  private schedulePreview(delay = 300): void {
    if (this.previewTimer !== null) window.clearTimeout(this.previewTimer);
    this.previewTimer = window.setTimeout(() => {
      this.previewTimer = null;
      if (this.busy) { this.schedulePreview(300); return; }
      void this.preview(true);
    }, delay);
  }

  private validate(notify = true): boolean {
    const reject = (message: string): false => {
      if (notify) new Notice(message);
      else if (this.statusEl) this.statusEl.textContent = message;
      return false;
    };
    if (!this.options.account.trim()) return reject("填写底部昵称后显示预览");
    if (this.options.showCoverImage && !this.options.coverImageDataUrl) return reject("请先上传顶部封面图");
    if (Array.from(this.options.authorSubtitle).length > 15) return reject("昵称下方文字不能超过 15 个字");
    if (this.options.showAvatar && !this.options.avatarDataUrl) return reject("请先上传头像图片");
    const font = this.plugin.fonts.find((item) => item.id === this.options.fontId);
    if (this.options.style === "handwrite" && (!font || (!font.available && font.source !== "downloadable"))) {
      return reject("所选手写字体未安装，请换一个字体");
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
    const parsed = parseMarkdown(markdown, this.options.showTitle ? this.file.basename : undefined);
    const covered = addCoverAuthor(parsed, this.options.showAvatar, this.options.account, this.options.authorSubtitle, authorTextVisible(this.options), this.options.avatarDataUrl);
    const blocks = await resolveImages(this.app, covered, this.file.path);
    const measurer = new LayoutMeasurer();
    await measurer.init(this.options, this.plugin.fonts);
    try { return paginate(blocks, measurer); }
    finally { measurer.destroy(); }
  }

  private async preview(silent = false): Promise<void> {
    if (!this.validate(!silent) || this.busy) return;
    this.setBusy(true, "正在排版…");
    try {
      this.pages = await this.buildPages();
      this.previewEl!.empty();
      for (let index = 0; index < this.pages.length; index++) {
        const page = this.pages[index]!;
        const wrapper = this.previewEl!.createDiv({ cls: "xhs-preview-frame" });
        if (page.blocks.some((block) => block.type === "motion")) {
          wrapper.createDiv({ cls: "xhs-motion-badge", text: Platform.isMacOS ? "实况照片" : "动态素材" });
        }
        const frame = wrapper.createEl("iframe");
        frame.srcdoc = pageDocument(this.options, this.plugin.fonts, this.pages[index]!, index, this.pages.length);
        frame.title = `第 ${index + 1} 页预览`;
      }
      const motionCount = this.pages.filter((page) => page.blocks.some((block) => block.type === "motion")).length;
      this.statusEl!.textContent = motionCount === 0
        ? `共 ${this.pages.length} 页，全部导出为 PNG`
        : Platform.isMacOS
          ? `共 ${this.pages.length} 页：${motionCount} 张实况照片、${this.pages.length - motionCount} 张普通图片；全部加入“照片”新相簿`
          : `共 ${this.pages.length} 页：全部 PNG，另附 ${motionCount} 份动态原件`;
    } catch (error) { this.reportError(error); }
    finally { this.setBusy(false); }
  }

  private async export(): Promise<void> {
    if (!this.validate() || this.busy) return;
    this.setBusy(true, "正在准备…");
    try {
      if (!this.pages) this.pages = await this.buildPages();
      const destination = await this.resolveExportDestination();
      const summary = await exportMixedPages(this.app, this.pages, this.options, this.plugin.fonts, destination, this.file.basename, (current, total, kind) => {
        if (!this.statusEl) return;
        if (kind === "photos-import") {
          this.statusEl.textContent = `正在加入“照片”相簿 ${current}/${total}…`;
          return;
        }
        const label = kind === "live-photo" ? "实况照片" : kind === "motion-original" ? "PNG 与动态原件" : "PNG";
        this.statusEl.textContent = `正在导出${label} ${current}/${total}…`;
      });
      this.lastExportDirectory = destination.fullPath;
      if (this.openFolderButton) this.openFolderButton.buttonEl.hidden = false;
      const details = Platform.isMacOS
        ? `${summary.livePhotoCount} 张实况照片、${summary.pngCount} 张 PNG`
        : `${summary.pngCount} 张 PNG、${summary.motionOriginalCount} 份动态原件`;
      const photosMessage = summary.photosAlbumName ? `\n已加入“照片”相簿：${summary.photosAlbumName}` : "";
      this.statusEl!.textContent = summary.photosAlbumName
        ? `已导出 ${details}；“照片”相簿：${summary.photosAlbumName}；原件：${destination.fullPath}`
        : `已导出 ${details}：${destination.fullPath}`;
      new Notice(`已导出 ${details}${photosMessage}\n原件位置：${destination.fullPath}`, 15000);
    } catch (error) { this.reportError(error); }
    finally { this.setBusy(false); }
  }

  private setBusy(busy: boolean, status?: string): void {
    this.busy = busy; this.previewButton?.setDisabled(busy); this.exportButton?.setDisabled(busy); this.openFolderButton?.setDisabled(busy);
    if (status && this.statusEl) this.statusEl.textContent = status;
  }

  private reportError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    if (this.statusEl) this.statusEl.textContent = `失败：${message}`;
    new Notice(`xhs-longform：${message}`, 8000);
    console.error("xhs-longform", error);
  }

  private async selectComputerOutputFolder(container?: HTMLElement): Promise<boolean> {
    try {
      const selected = chooseComputerFolder(this.plugin.settings.computerOutputDir);
      if (!selected) return false;
      this.plugin.settings.computerOutputDir = selected;
      await this.plugin.saveSettings();
      if (container) {
        container.empty();
        this.renderControls(container);
      }
      return true;
    } catch (error) {
      this.reportError(error);
      return false;
    }
  }

  private async resolveExportDestination(): Promise<ExportDestination> {
    if (this.plugin.settings.outputLocationMode === "computer") {
      if (!this.plugin.settings.computerOutputDir && !await this.selectComputerOutputFolder()) {
        throw new Error("尚未选择导出文件夹");
      }
      const directory = resolveComputerDirectory(this.plugin.settings.computerOutputDir, this.file.basename);
      return { kind: "computer", directory, fullPath: directory };
    }
    const directory = resolveVaultDirectory(this.plugin.settings.outputDir, this.file.basename);
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) throw new Error("当前仓库不支持本地文件导出");
    return { kind: "vault", directory, fullPath: adapter.getFullPath(directory) };
  }

  private async openLastExportFolder(): Promise<void> {
    if (!this.lastExportDirectory) return;
    try { await openComputerFolder(this.lastExportDirectory); }
    catch (error) { this.reportError(error); }
  }
}
