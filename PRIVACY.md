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

No note contents, local images, account names, usage data, or imported fonts
are included in that request. The plugin makes no other runtime network
requests and collects no analytics.
