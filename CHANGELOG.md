# Changelog

All notable changes to XHS Longform Exporter are documented here.

## 1.4.0 - 2026-07-23

- Automatically detect MP4, MOV, and GIF embeds in the current note without asking users to select the media again.
- Replace separate PNG and Live Photo actions with one automatic mixed-export button.
- On macOS, when any page contains motion, add the complete page sequence to a new Photos album: dynamic pages as Apple Live Photos and static pages as regular photos.
- Keep all PNG and JPEG/MOV originals in the selected export folder as a separate backup.
- Explain the Photos destination before export, show album-import progress, and report both the album name and backup path when finished.
- Keep the full card design in motion exports and animate only the embedded media region.
- Keep at most one dynamic asset on each page so every motion page maps to one valid Live Photo.
- Export static PNG previews plus the original dynamic files on Windows and Linux.
- Bundle a universal Intel and Apple Silicon Live Photo converter so macOS users do not need Xcode, Swift, or FFmpeg.

## 1.3.0 - 2026-07-23

- Add a choice between exporting inside the current vault and exporting to any computer folder.
- Open the native desktop folder picker from both plugin settings and the export panel.
- Show the complete output path after every export and provide an **Open folder** button.
- Keep each note's images organized in a note-named subfolder when exporting outside the vault.

## 1.2.1 - 2026-07-18

- Fix false "not installed" results for macOS system fonts such as PingFang SC by measuring the real browser font output instead of loading `local()` through `FontFace`.
- Render detected system fonts through their actual installed family names.

## 1.2.0 - 2026-07-18

- Replace the three legacy cover modes with independent cover-image, avatar, and title switches, including automatic migration for existing settings.
- Add local avatar upload, replacement, deletion, centered cropping, and nickname display on the cover only.
- Enlarge the cover avatar, nickname, and the spacing before the title or body.
- Add small, medium, and large avatar-area presets, with medium as the default.
- Add optional 15-character author subtitles and an avatar-only author layout.
- Add locally processed full-width cover images with avatars overlapping the image boundary.
- Group settings into cover and author, visual style, typography and page, and export sections.
- Show image upload controls only after the corresponding cover or avatar option is selected.
- Make cover-image layouts avatar-only and move overflowing final lines to the next page with a larger footer safety zone.
- Keep the bottom account label on cover-image pages even when the author block is avatar-only.
- Fix title visibility when a top cover image is enabled.
- Rework the export modal into left-side controls and a right-side live preview.
- Display actual pixel font sizes in selectors instead of relative size labels.
- Add adjustable horizontal and top margins and use them in real layout measurement and pagination.
- Publish a Chinese-first README with cover and handwriting previews.
- Rewrite the Chinese plugin page around quick start, live-preview controls, cover combinations, use cases, and clearly captioned result images.
- Add an original editorial cover and matching avatar plus a three-card cold-black README gallery.

## 1.1.2 - 2026-07-17

- Publish without release attestations as a temporary compatibility workaround for the Obsidian Community scanner.
- Keep the smaller on-demand font package and SHA-256 font verification unchanged.

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
