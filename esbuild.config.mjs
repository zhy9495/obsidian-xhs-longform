import esbuild from "esbuild";
import { readFile } from "node:fs/promises";

const production = process.argv[2] === "production";
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "node:child_process", "node:fs/promises", "node:os", "node:path"],
  loader: { ".live-photo-tool": "base64" },
  format: "cjs",
  target: "es2022",
  platform: "browser",
  outfile: "main.js",
  banner: { js: `/* XHS Longform Exporter ${manifest.version} */` },
  sourcemap: production ? false : "inline",
  minify: production,
  logLevel: "info"
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
