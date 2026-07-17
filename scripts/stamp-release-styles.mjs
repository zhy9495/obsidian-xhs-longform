import { readFile, writeFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const styles = await readFile("styles.css", "utf8");
const stamp = `\n/* XHS Longform Exporter ${manifest.version} */\n`;

await writeFile("styles.css", `${styles.trimEnd()}${stamp}`, "utf8");
