# Privacy

XHS Longform Exporter does not collect analytics, transmit note contents, or
send imported fonts and images to any server.

All parsing, pagination, preview rendering, and PNG generation happen locally
inside Obsidian. Exported images are written to the current vault. Custom font
files are copied to `.xhs-longform/fonts` in the current vault and are only
read when the plugin renders a preview or export.

When a user first selects one of the three optional OFL fonts, the plugin
downloads that font from the version-pinned `assets/fonts` path in this public
GitHub repository. It verifies the file against a hard-coded SHA-256 hash and
caches it in IndexedDB on the current computer. The cache is outside the vault,
is not synchronized by Obsidian Sync, and can be cleared in plugin settings.

No note contents, local images, cover images, avatars, account names, usage data, or imported fonts
are included in that request. The plugin makes no other runtime network
requests and collects no analytics.

For motion export, the plugin reads only MP4, MOV, and GIF files explicitly
embedded in the current note and writes output to the user-selected export
directory. On macOS, when an export contains at least one motion page, it runs
the bundled, open-source Live Photo converter from a temporary directory,
creates a new album in the system Photos application, and imports the complete
page sequence into that album. Motion pages are imported as JPEG/MOV Live Photo
pairs and static pages as regular photos. The selected export directory keeps
the corresponding originals as a local backup. Temporary conversion files are
deleted after conversion. Videos and generated resources are never uploaded.
