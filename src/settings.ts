import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type XhsLongformPlugin from "./main";
import type { AvatarSize, PageMargin, SizeScale, StyleId, TextureId } from "./types";
import { AVATAR_SIZES, fontSizeOptions, PAGE_MARGINS, PALETTES, type TypographyRole } from "./presets";
import { DEFAULT_HANDWRITING_FONT_ID, type CustomFontConfig } from "./fonts";
import { limitAuthorSubtitle } from "./cover";
import { chooseComputerFolder, openComputerFolder } from "./desktop";
import type { OutputLocationMode } from "./export-location";

export type XhsLongformSettings = {
  account: string;
  style: StyleId;
  paletteId: string;
  fontId: string;
  texture: TextureId;
  titleScale: SizeScale;
  subtitleScale: SizeScale;
  bodyScale: SizeScale;
  horizontalMargin: PageMargin;
  topMargin: PageMargin;
  showAvatar: boolean;
  showTitle: boolean;
  avatarDataUrl: string;
  avatarSize: AvatarSize;
  authorSubtitle: string;
  coverImageDataUrl: string;
  showCoverImage: boolean;
  customFonts: CustomFontConfig[];
  outputLocationMode: OutputLocationMode;
  outputDir: string;
  computerOutputDir: string;
};

export const DEFAULT_SETTINGS: XhsLongformSettings = {
  account: "", style: "pingfang", paletteId: "paper-white", fontId: DEFAULT_HANDWRITING_FONT_ID, texture: "auto",
  titleScale: "100", subtitleScale: "100", bodyScale: "100", horizontalMargin: "88", topMargin: "88",
  showAvatar: false, showTitle: true, avatarDataUrl: "", avatarSize: "medium", authorSubtitle: "",
  coverImageDataUrl: "", showCoverImage: false, customFonts: [],
  outputLocationMode: "vault", outputDir: "xhs-export/{{title}}", computerOutputDir: ""
};

export class XhsLongformSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: XhsLongformPlugin) { super(app, plugin); }

  display(): void {
    const { containerEl } = this; containerEl.empty();
    new Setting(containerEl).setName("封面与作者").setHeading();
    this.renderCoverSettings(containerEl);
    new Setting(containerEl).setName("视觉样式").setHeading();
    new Setting(containerEl).setName("风格").addDropdown((dropdown) => dropdown.addOption("pingfang", "简约黑体").addOption("handwrite", "手写纹理").setValue(this.plugin.settings.style).onChange(async (value) => {
      this.plugin.settings.style = value as StyleId;
      this.plugin.settings.paletteId = value === "pingfang" ? "paper-white" : "cool-black";
      await this.plugin.saveSettings(); this.display();
    }));
    new Setting(containerEl).setName("配色").addDropdown((dropdown) => {
      for (const palette of PALETTES.filter((item) => item.style === this.plugin.settings.style)) dropdown.addOption(palette.id, palette.name);
      return dropdown.setValue(this.plugin.settings.paletteId).onChange(async (value) => { this.plugin.settings.paletteId = value; await this.plugin.saveSettings(); });
    });
    new Setting(containerEl).setName("手写字体").setDesc("优先调用本机字体；三款开源字体会在首次使用时下载，也可以在下方导入字体文件。").setDisabled(this.plugin.settings.style !== "handwrite").addDropdown((dropdown) => {
      for (const font of this.plugin.fonts) dropdown.addOption(font.id, this.fontLabel(font));
      for (const option of Array.from(dropdown.selectEl.options)) {
        const font = this.plugin.fonts.find((item) => item.id === option.value);
        option.disabled = Boolean(font && !font.available && font.source !== "downloadable");
      }
      return dropdown.setValue(this.plugin.settings.fontId).onChange(async (value) => { this.plugin.settings.fontId = value; await this.plugin.saveSettings(); });
    });
    new Setting(containerEl).setName("下载字体缓存").setDesc("开源字体只缓存在当前电脑的应用数据中，不写入 vault，也不会通过 Obsidian Sync 同步。").addButton((button) => button.setButtonText("清除缓存").onClick(async () => {
      try { await this.plugin.clearDownloadedFonts(); new Notice("已清除下载字体缓存"); this.display(); }
      catch (error) { new Notice(`清除失败：${error instanceof Error ? error.message : String(error)}`); }
    }));
    this.renderCustomFontSettings(containerEl);
    new Setting(containerEl).setName("纹理").setDisabled(this.plugin.settings.style !== "handwrite").addDropdown((dropdown) => dropdown
      .addOption("auto", "跟随配色推荐").addOption("none", "无纹理").addOption("grid", "格子纸").addOption("dot", "圆点纸").addOption("line", "横线纸")
      .setValue(this.plugin.settings.texture).onChange(async (value) => { this.plugin.settings.texture = value as TextureId; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("文字与页面").setHeading();
    this.addSizeSetting(containerEl, "标题字号", "文件名标题的实际导出字号。", "title", this.plugin.settings.titleScale, async (value) => { this.plugin.settings.titleScale = value; await this.plugin.saveSettings(); });
    this.addSizeSetting(containerEl, "小标题字号", "正文中 # 标题的实际导出字号；## 与 ### 会依次缩小。", "subtitle", this.plugin.settings.subtitleScale, async (value) => { this.plugin.settings.subtitleScale = value; await this.plugin.saveSettings(); });
    this.addSizeSetting(containerEl, "正文字号", "正文的实际导出字号，同时影响列表、引用和表格。", "body", this.plugin.settings.bodyScale, async (value) => { this.plugin.settings.bodyScale = value; await this.plugin.saveSettings(); });
    this.addMarginSetting(containerEl, "左右边距", "缩小后每行可以容纳更多文字。", this.plugin.settings.horizontalMargin, async (value) => { this.plugin.settings.horizontalMargin = value; await this.plugin.saveSettings(); });
    this.addMarginSetting(containerEl, "顶部边距", "缩小后每页可以容纳更多内容。", this.plugin.settings.topMargin, async (value) => { this.plugin.settings.topMargin = value; await this.plugin.saveSettings(); });
    new Setting(containerEl).setName("导出").setHeading();
    new Setting(containerEl).setName("保存位置").setDesc("可以保存到当前 Obsidian 仓库，也可以选择电脑上的任意文件夹。").addDropdown((dropdown) => dropdown
      .addOption("vault", "当前 Obsidian 仓库")
      .addOption("computer", "电脑文件夹")
      .setValue(this.plugin.settings.outputLocationMode)
      .onChange(async (value) => {
        this.plugin.settings.outputLocationMode = value as OutputLocationMode;
        await this.plugin.saveSettings();
        this.display();
      }));
    if (this.plugin.settings.outputLocationMode === "vault") {
      new Setting(containerEl).setName("仓库内目录").setDesc("{{title}} 会替换为当前笔记名。").addText((text) => text
        .setValue(this.plugin.settings.outputDir)
        .onChange(async (value) => {
          this.plugin.settings.outputDir = value || DEFAULT_SETTINGS.outputDir;
          await this.plugin.saveSettings();
        }));
    } else {
      const setting = new Setting(containerEl).setName("电脑文件夹")
        .setDesc(this.plugin.settings.computerOutputDir || "尚未选择；导出时会在所选文件夹内建立笔记同名子文件夹。");
      setting.addButton((button) => button.setButtonText(this.plugin.settings.computerOutputDir ? "更换" : "选择").setCta().onClick(async () => {
        const selected = chooseComputerFolder(this.plugin.settings.computerOutputDir);
        if (!selected) return;
        this.plugin.settings.computerOutputDir = selected;
        await this.plugin.saveSettings();
        this.display();
      }));
      if (this.plugin.settings.computerOutputDir) {
        setting.addExtraButton((button) => button.setIcon("folder-open").setTooltip("打开文件夹").onClick(async () => {
          try { await openComputerFolder(this.plugin.settings.computerOutputDir); }
          catch (error) { new Notice(`无法打开文件夹：${error instanceof Error ? error.message : String(error)}`); }
        }));
      }
    }
  }

  private fontLabel(font: XhsLongformPlugin["fonts"][number]): string {
    if (font.available) return font.name;
    return font.source === "downloadable" ? `${font.name}（首次使用时下载）` : `${font.name}（未安装）`;
  }

  private addSizeSetting(container: HTMLElement, name: string, description: string, role: TypographyRole, value: SizeScale, onChange: (value: SizeScale) => Promise<void>): void {
    new Setting(container).setName(name).setDesc(description).addDropdown((dropdown) => {
      for (const option of fontSizeOptions(this.plugin.settings.style, role)) dropdown.addOption(option.id, option.label);
      return dropdown.setValue(value).onChange((next) => void onChange(next as SizeScale));
    });
  }

  private addMarginSetting(container: HTMLElement, name: string, description: string, value: PageMargin, onChange: (value: PageMargin) => Promise<void>): void {
    new Setting(container).setName(name).setDesc(description).addDropdown((dropdown) => {
      for (const option of PAGE_MARGINS) dropdown.addOption(option.id, option.name);
      return dropdown.setValue(value).onChange((next) => void onChange(next as PageMargin));
    });
  }

  private renderCoverSettings(container: HTMLElement): void {
    new Setting(container).setName("底部昵称").setDesc("固定显示在每一页底部，页码也会始终显示。")
      .addText((text) => text.setPlaceholder("必填，例如 ying").setValue(this.plugin.settings.account).onChange(async (value) => { this.plugin.settings.account = value.trim(); await this.plugin.saveSettings(); }));
    new Setting(container).setName("显示顶部封面图").setDesc("开启后才显示封面图上传选项。").addToggle((toggle) => toggle.setValue(this.plugin.settings.showCoverImage).onChange(async (value) => {
      this.plugin.settings.showCoverImage = value; await this.plugin.saveSettings(); this.display();
    }));
    if (this.plugin.settings.showCoverImage) this.renderCoverImageSetting(container);
    new Setting(container).setName("显示头像").setDesc(this.plugin.settings.showCoverImage ? "头像叠在封面图与底图的分割线上。" : "头像与昵称显示在第一页顶部，内页不重复。").addToggle((toggle) => toggle.setValue(this.plugin.settings.showAvatar).onChange(async (value) => {
      this.plugin.settings.showAvatar = value; await this.plugin.saveSettings(); this.display();
    }));
    if (this.plugin.settings.showAvatar) {
      this.renderAvatarSetting(container);
      new Setting(container).setName("头像区域大小").setDesc("同时调整头像和周围间距；默认使用中档。").addDropdown((dropdown) => {
        for (const option of AVATAR_SIZES) dropdown.addOption(option.id, option.name);
        return dropdown.setValue(this.plugin.settings.avatarSize).onChange(async (value) => { this.plugin.settings.avatarSize = value as AvatarSize; await this.plugin.saveSettings(); });
      });
    }
    if (this.plugin.settings.showAvatar && !this.plugin.settings.showCoverImage) {
      new Setting(container).setName("昵称下方文字").setDesc("可填写日期、账号或任意一句话，最多 15 个字；留空时昵称垂直居中。")
        .addText((text) => {
          return text.setPlaceholder("选填，最多 15 个字").setValue(this.plugin.settings.authorSubtitle).onChange(async (value) => {
            const limited = limitAuthorSubtitle(value); if (limited !== value) text.setValue(limited);
            this.plugin.settings.authorSubtitle = limited; await this.plugin.saveSettings();
          });
        });
    }
    new Setting(container).setName("显示标题").setDesc("标题取当前笔记的文件名，关闭后直接从正文开始。").addToggle((toggle) => toggle.setValue(this.plugin.settings.showTitle).onChange(async (value) => {
      this.plugin.settings.showTitle = value; await this.plugin.saveSettings();
    }));
  }

  private renderAvatarSetting(container: HTMLElement): void {
    const setting = new Setting(container).setName("封面头像").setDesc(this.plugin.settings.avatarDataUrl ? "已保存到当前插件设置中；导出时可以更换或删除。" : "上传后自动居中裁切为正方形，仅用于封面。");
    if (this.plugin.settings.avatarDataUrl) {
      const preview = setting.controlEl.createEl("img", { cls: "xhs-avatar-preview", attr: { src: this.plugin.settings.avatarDataUrl, alt: "当前头像" } });
      preview.setAttribute("aria-hidden", "true");
      setting.addExtraButton((button) => button.setIcon("trash-2").setTooltip("删除头像").onClick(async () => {
        await this.plugin.removeAvatar(); new Notice("已删除封面头像"); this.display();
      }));
    }
    const input = setting.controlEl.createEl("input", { cls: "xhs-avatar-file-input", attr: { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif" } });
    setting.addButton((button) => button.setButtonText(this.plugin.settings.avatarDataUrl ? "更换" : "上传").onClick(() => input.click()));
    this.plugin.registerDomEvent(input, "change", () => {
      const file = input.files?.[0]; if (!file) return;
      void this.importAvatar(file).finally(() => { input.value = ""; });
    });
  }

  private renderCoverImageSetting(container: HTMLElement): void {
    const setting = new Setting(container).setName("顶部封面图").setDesc(this.plugin.settings.coverImageDataUrl ? "封面图会铺满第一页上方，可更换或删除。" : "选填；上传后自动裁切为通栏封面图。");
    if (this.plugin.settings.coverImageDataUrl) {
      setting.controlEl.createEl("img", { cls: "xhs-cover-image-preview", attr: { src: this.plugin.settings.coverImageDataUrl, alt: "当前封面图" } });
      setting.addExtraButton((button) => button.setIcon("trash-2").setTooltip("删除封面图").onClick(async () => {
        await this.plugin.removeCoverImage(); new Notice("已删除顶部封面图"); this.display();
      }));
    }
    const input = setting.controlEl.createEl("input", { cls: "xhs-avatar-file-input", attr: { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif" } });
    setting.addButton((button) => button.setButtonText(this.plugin.settings.coverImageDataUrl ? "更换" : "上传").onClick(() => input.click()));
    this.plugin.registerDomEvent(input, "change", () => {
      const file = input.files?.[0]; if (!file) return;
      void this.importCoverImage(file).finally(() => { input.value = ""; });
    });
  }

  private async importCoverImage(file: File): Promise<void> {
    try { await this.plugin.importCoverImage(file); new Notice("顶部封面图已保存"); this.display(); }
    catch (error) { new Notice(`封面图导入失败：${error instanceof Error ? error.message : String(error)}`, 8000); }
  }

  private async importAvatar(file: File): Promise<void> {
    try { await this.plugin.importAvatar(file); new Notice("头像已保存"); this.display(); }
    catch (error) { new Notice(`头像导入失败：${error instanceof Error ? error.message : String(error)}`, 8000); }
  }

  private renderCustomFontSettings(container: HTMLElement): void {
    const importSetting = new Setting(container)
      .setName("导入自定义字体")
      .setDesc("支持 ttf、otf、woff、woff2；字体只保存到当前 vault 的 .xhs-longform/fonts，不会上传或安装到操作系统。最大 30 mb。");
    const input = importSetting.controlEl.createEl("input", {
      cls: "xhs-font-file-input",
      attr: { type: "file", accept: ".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" }
    });
    this.plugin.registerDomEvent(input, "change", () => {
      const file = input.files?.[0];
      if (!file) return;
      void this.importFont(file).finally(() => { input.value = ""; });
    });

    if (!this.plugin.settings.customFonts.length) return;
    new Setting(container).setName("已导入字体").setHeading();
    for (const font of this.plugin.settings.customFonts) {
      new Setting(container)
        .setName(font.name)
        .setDesc(font.path)
        .addExtraButton((button) => button.setIcon("trash-2").setTooltip("移除字体").onClick(async () => {
          try {
            await this.plugin.removeCustomFont(font.id);
            new Notice(`已移除字体：${font.name}`);
            this.display();
          } catch (error) { new Notice(`移除失败：${error instanceof Error ? error.message : String(error)}`); }
        }));
    }
  }

  private async importFont(file: File): Promise<void> {
    try {
      await this.plugin.importCustomFont(file);
      new Notice(`已导入字体：${file.name}`);
      this.display();
    } catch (error) { new Notice(`导入失败：${error instanceof Error ? error.message : String(error)}`, 8000); }
  }
}
