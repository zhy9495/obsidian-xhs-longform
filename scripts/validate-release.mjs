import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const versions = JSON.parse(await readFile("versions.json", "utf8"));
const tag = process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined;

if (manifest.version !== pkg.version) throw new Error("manifest.json and package.json versions differ");
if (versions[manifest.version] !== manifest.minAppVersion) throw new Error("versions.json is missing the current version mapping");
if (tag && tag !== manifest.version) throw new Error(`Git tag ${tag} must exactly match manifest version ${manifest.version}`);
