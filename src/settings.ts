import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type XhsLongformPlugin from "./main";
import type { SizeScale, StyleId, TextureId } from "./types";
import { PALETTES, SIZE_SCALES } from "./presets";
import { DEFAULT_HANDWRITING_FONT_ID, type CustomFontConfig } from "./fonts";

export type XhsLongformSettings = {
  account: string;
  style: StyleId;
  paletteId: string;
  fontId: string;
  texture: TextureId;
  titleScale: SizeScale;
  subtitleScale: SizeScale;
  bodyScale: SizeScale;
  customFonts: CustomFontConfig[];
  outputDir: string;
};

export const DEFAULT_SETTINGS: XhsLongformSettings = {
  account: "", style: "pingfang", paletteId: "paper-white", fontId: DEFAULT_HANDWRITING_FONT_ID, texture: "auto",
  titleScale: "100", subtitleScale: "100", bodyScale: "100", customFonts: [], outputDir: "xhs-export/{{title}}"
};

export class XhsLongformSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: XhsLongformPlugin) { super(app, plugin); }

  display(): void {
    const { containerEl } = this; containerEl.empty();
    new Setting(containerEl).setName("账号名").setDesc("导出弹窗中仍可临时修改。").addText((text) => text.setPlaceholder("例如 ying").setValue(this.plugin.settings.account).onChange(async (value) => { this.plugin.settings.account = value.trim(); await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("风格").addDropdown((dropdown) => dropdown.addOption("pingfang", "简约黑体").addOption("handwrite", "手写纹理").setValue(this.plugin.settings.style).onChange(async (value) => {
      this.plugin.settings.style = value as StyleId;
      this.plugin.settings.paletteId = value === "pingfang" ? "paper-white" : "cool-black";
      await this.plugin.saveSettings(); this.display();
    }));
    new Setting(containerEl).setName("配色").addDropdown((dropdown) => {
      for (const palette of PALETTES.filter((item) => item.style === this.plugin.settings.style)) dropdown.addOption(palette.id, palette.name);
      return dropdown.setValue(this.plugin.settings.paletteId).onChange(async (value) => { this.plugin.settings.paletteId = value; await this.plugin.saveSettings(); });
    });
    new Setting(containerEl).setName("手写字体").setDesc("优先调用本机平方字体；另有三款内置开源字体，也可以在下方导入字体文件。").setDisabled(this.plugin.settings.style !== "handwrite").addDropdown((dropdown) => {
      for (const font of this.plugin.fonts) dropdown.addOption(font.id, font.available ? font.name : `${font.name}（文件缺失）`);
      for (const option of Array.from(dropdown.selectEl.options)) option.disabled = !this.plugin.fonts.find((font) => font.id === option.value)?.available;
      return dropdown.setValue(this.plugin.settings.fontId).onChange(async (value) => { this.plugin.settings.fontId = value; await this.plugin.saveSettings(); });
    });
    this.renderCustomFontSettings(containerEl);
    new Setting(containerEl).setName("纹理").setDisabled(this.plugin.settings.style !== "handwrite").addDropdown((dropdown) => dropdown
      .addOption("auto", "跟随配色推荐").addOption("none", "无纹理").addOption("grid", "格子纸").addOption("dot", "圆点纸").addOption("line", "横线纸")
      .setValue(this.plugin.settings.texture).onChange(async (value) => { this.plugin.settings.texture = value as TextureId; await this.plugin.saveSettings(); }));
    this.addSizeSetting(containerEl, "标题字号", "文件名标题的字号。", this.plugin.settings.titleScale, async (value) => { this.plugin.settings.titleScale = value; await this.plugin.saveSettings(); });
    this.addSizeSetting(containerEl, "小标题字号", "正文中 # 标题的基准字号；## 与 ### 会依次缩小。", this.plugin.settings.subtitleScale, async (value) => { this.plugin.settings.subtitleScale = value; await this.plugin.saveSettings(); });
    this.addSizeSetting(containerEl, "正文字号", "同时影响正文、列表、引用和表格。", this.plugin.settings.bodyScale, async (value) => { this.plugin.settings.bodyScale = value; await this.plugin.saveSettings(); });
    new Setting(containerEl).setName("导出目录").setDesc("{{title}} 会替换为当前笔记名。").addText((text) => text.setValue(this.plugin.settings.outputDir).onChange(async (value) => { this.plugin.settings.outputDir = value || DEFAULT_SETTINGS.outputDir; await this.plugin.saveSettings(); }));
  }

  private addSizeSetting(container: HTMLElement, name: string, description: string, value: SizeScale, onChange: (value: SizeScale) => Promise<void>): void {
    new Setting(container).setName(name).setDesc(description).addDropdown((dropdown) => {
      for (const option of SIZE_SCALES) dropdown.addOption(option.id, option.name);
      return dropdown.setValue(value).onChange((next) => void onChange(next as SizeScale));
    });
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
