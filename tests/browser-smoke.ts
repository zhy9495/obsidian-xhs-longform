import { domToPng } from "modern-screenshot";
import { parseMarkdown } from "../src/parser";
import { LayoutMeasurer } from "../src/measure";
import { paginate } from "../src/paginate";
import { pageDocument } from "../src/render";
import { GEOMETRY as G } from "../src/presets";
import type { ExportOptions } from "../src/types";
import { DOWNLOADABLE_HANDWRITING_FONTS } from "../src/downloadable-fonts";
import type { LoadedFont } from "../src/fonts";
import { addCoverAuthor } from "../src/cover";
import { prepareAvatar, prepareCoverImage } from "../src/avatar";

const DOWNLOADABLE_TEST_FONTS: LoadedFont[] = DOWNLOADABLE_HANDWRITING_FONTS.map((font) => ({
  id: font.id, name: font.name, family: font.family, source: font.source, format: font.format,
  available: true, faceCss: ""
}));

// Obsidian adds createEl to HTMLElement. Reproduce that small host API in the
// standalone Chromium smoke page.
if (!HTMLElement.prototype.createEl) {
  HTMLElement.prototype.createEl = function <K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    this.append(element);
    return element;
  };
}

async function main(): Promise<void> {
  const result = document.querySelector("#result")!;
  try {
    const markdown = `# 浏览器排版测试\n\n${"这是一段用于检查中文真实换行与灌注式分页的正文。".repeat(180)}`;
    const avatarSeed = document.body.createEl("canvas"); avatarSeed.width = 200; avatarSeed.height = 200;
    const avatarContext = avatarSeed.getContext("2d")!; avatarContext.fillStyle = "#d9c8b4"; avatarContext.fillRect(0, 0, 200, 200);
    const avatarBlob = await new Promise<Blob>((resolve, reject) => avatarSeed.toBlob((blob) => blob ? resolve(blob) : reject(new Error("avatar seed failed")), "image/png"));
    avatarSeed.remove();
    const avatar = await prepareAvatar(new File([avatarBlob], "avatar.png", { type: "image/png" }));
    const coverImage = await prepareCoverImage(new File([avatarBlob], "cover.png", { type: "image/png" }));
    const options: ExportOptions = {
      account: "smoke", style: "pingfang", paletteId: "paper-white", fontId: "sat-to", texture: "auto",
      titleScale: "100", subtitleScale: "100", bodyScale: "100", horizontalMargin: "88", topMargin: "88",
      showAvatar: true, showTitle: true, avatarDataUrl: avatar, avatarSize: "medium", authorSubtitle: "浏览器测试", coverImageDataUrl: coverImage, showCoverImage: true
    };
    const measurer = new LayoutMeasurer();
    await measurer.init(options, []);
    const blocks = addCoverAuthor(parseMarkdown(markdown, options.showTitle ? "冒烟测试文档" : undefined), options.showAvatar, "小颖", "浏览器测试", false, avatar);
    const pages = paginate(blocks, measurer);
    const heights = pages.map((page) => page.blocks.reduce((sum, block) => sum + measurer.measure(block), 0));
    const capacities = pages.map((_, index) => index === 0 ? measurer.firstPageContentHeight : measurer.contentHeight);
    measurer.destroy();
    const nonFinalGaps = heights.slice(0, -1).map((height, index) => capacities[index]! - height);

    const compactOptions: ExportOptions = { ...options, titleScale: "80", subtitleScale: "80", bodyScale: "80" };
    const compactMeasurer = new LayoutMeasurer();
    await compactMeasurer.init(compactOptions, []);
    const compactPages = paginate(blocks, compactMeasurer);
    compactMeasurer.destroy();

    const handwritingPageCounts: Record<string, number> = {};
    for (const font of DOWNLOADABLE_TEST_FONTS) {
      const fontOptions: ExportOptions = { ...options, style: "handwrite", paletteId: "milk-tea", fontId: font.id };
      const handwritingMeasurer = new LayoutMeasurer();
      await handwritingMeasurer.init(fontOptions, DOWNLOADABLE_TEST_FONTS);
      handwritingPageCounts[font.id] = paginate(blocks, handwritingMeasurer).length;
      handwritingMeasurer.destroy();
    }

    const handwritingOptions: ExportOptions = { ...options, style: "handwrite", paletteId: "milk-tea", fontId: "xiaolai-regular" };
    const previewMeasurer = new LayoutMeasurer();
    await previewMeasurer.init(handwritingOptions, DOWNLOADABLE_TEST_FONTS);
    const handwritingPages = paginate(blocks, previewMeasurer);
    previewMeasurer.destroy();

    const iframe = document.createElement("iframe");
    iframe.style.cssText = `width:${G.width}px;height:${G.height}px;border:0`;
    const loaded = new Promise<void>((resolve) => iframe.addEventListener("load", () => resolve(), { once: true }));
    iframe.srcdoc = pageDocument(handwritingOptions, DOWNLOADABLE_TEST_FONTS, handwritingPages[0]!, 0, handwritingPages.length);
    document.body.append(iframe);
    await loaded;
    const card = iframe.contentDocument!.querySelector<HTMLElement>(".xhs-card")!;
    const hasCoverImage = Boolean(card.querySelector(".xhs-cover-image")) && card.classList.contains("xhs-card-cover");
    const avatarOnly = !card.querySelector(".xhs-author-text") && card.querySelector(".xhs-account")?.textContent === "@smoke";
    const titleVisibleWithCover = card.querySelector(".xhs-cover-title")?.textContent === "冒烟测试文档";
    const png = await domToPng(card, { width: G.width, height: G.height, scale: 1 });
    const image = new Image(); image.src = png; await image.decode();

    const report = {
      ok: avatar.startsWith("data:image/webp") && coverImage.startsWith("data:image/webp") && hasCoverImage && avatarOnly && titleVisibleWithCover && pages.length > 1 && compactPages.length < pages.length && pages[0]?.blocks[0]?.type === "author" && pages.slice(1).every((page) => page.blocks.every((block) => block.type !== "author")) && Object.values(handwritingPageCounts).every((count) => count > 1) && nonFinalGaps.every((gap) => gap >= -0.1 && gap < 80) && image.naturalWidth === 1080 && image.naturalHeight === 1440,
      pages: pages.length,
      compactPages: compactPages.length,
      handwritingPages: handwritingPageCounts,
      heights,
      nonFinalGaps,
      png: [image.naturalWidth, image.naturalHeight]
    };
    result.textContent = JSON.stringify(report);
    document.body.dataset.done = "true";
  } catch (error) {
    result.textContent = JSON.stringify({ ok: false, error: error instanceof Error ? error.stack : String(error) });
    document.body.dataset.done = "true";
  }
}

void main();
