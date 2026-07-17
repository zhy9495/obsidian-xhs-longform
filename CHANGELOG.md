# Changelog

All notable changes to XHS Longform Exporter are documented here.

## 1.1.1 - 2026-07-17

- Generate standard Sigstore build-provenance attestations for every release asset.
- Verify all release attestations with GitHub CLI before creating the release.

## 1.1.0 - 2026-07-17

- Reduce the install package by downloading the three OFL fonts only when first used.
- Verify downloaded fonts with SHA-256 and cache them outside the vault in IndexedDB.
- Add PingFang SC as a local system-font option without copying or modifying it.
- Keep imported fonts and the six locally installed PingFang handwriting fonts unchanged.

## 1.0.2 - 2026-07-17

- Stamp generated release assets with the current version so each release has unique, verifiable file digests.

## 1.0.1 - 2026-07-17

- Publish releases as immutable GitHub releases with verifiable release attestations.

## 1.0.0 - 2026-07-17

- Export Markdown notes as paginated 1080×1440 PNG cards.
- Use the note filename as the cover title and support three heading levels.
- Add independent title, heading, and body font-size controls.
- Add nine color palettes and paper textures.
- Bundle Xiaolai, Naikai, and CEF Fonts CJK under SIL OFL 1.1.
- Detect compatible handwriting fonts already installed on the computer.
- Import local TTF, OTF, WOFF, and WOFF2 fonts into the current vault.
- Keep preview, pagination, image processing, and export fully local.
