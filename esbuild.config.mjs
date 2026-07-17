import esbuild from "esbuild";
import { readFile } from "node:fs/promises";

const production = process.argv[2] === "production";
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  target: "es2022",
  platform: "browser",
  outfile: "main.js",
  loader: { ".woff2": "dataurl" },
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
