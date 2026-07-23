import { describe, expect, it } from "vitest";
import path from "node:path";
import { resolveComputerDirectory, resolveVaultDirectory, sanitizeExportTitle } from "../src/export-location";

describe("export location", () => {
  it("replaces characters that cannot be used in cross-platform folder names", () => {
    expect(sanitizeExportTitle('一篇:需要/清理?"的文章. ')).toBe("一篇-需要-清理--的文章");
    expect(sanitizeExportTitle(" \u0001 ")).toBe("-");
  });

  it("expands the title placeholder for a vault folder", () => {
    expect(resolveVaultDirectory("/xhs-export/{{title}}/", "标题:一")).toBe("xhs-export/标题-一");
  });

  it("rejects paths that escape the vault", () => {
    expect(() => resolveVaultDirectory("../Downloads/{{title}}", "标题")).toThrow("仓库内导出目录无效");
  });

  it("creates a note-named child folder below the selected computer folder", () => {
    const root = path.resolve("/tmp/xhs-exports");
    expect(resolveComputerDirectory(root, "标题/一")).toBe(path.join(root, "标题-一"));
  });

  it("requires an absolute computer folder", () => {
    expect(() => resolveComputerDirectory("Downloads", "标题")).toThrow("请先选择电脑上的导出文件夹");
  });
});
