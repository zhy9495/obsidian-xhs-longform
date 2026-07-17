import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(
  globalIgnores([
    "node_modules", "main.js", "tests/browser-smoke.ts", "tests/browser-smoke.bundle.js", "assets/fonts/*.woff2",
    "esbuild.config.mjs", "package.json", "package-lock.json", "versions.json"
  ]),
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: { allowDefaultProject: ["eslint.config.mts", "manifest.json", "scripts/*.mjs"] },
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".json"]
      }
    }
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["src/settings.ts"],
    rules: {
      "obsidianmd/settings-tab/prefer-setting-definitions": "off",
      "@typescript-eslint/no-deprecated": "off"
    }
  },
  {
    files: ["src/render.ts"],
    rules: { "obsidianmd/prefer-create-el": "off" }
  }
);
