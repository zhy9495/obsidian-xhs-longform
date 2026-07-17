# Privacy

XHS Longform Exporter does not collect analytics, transmit note contents, or
send imported fonts and images to any server.

All parsing, pagination, preview rendering, and PNG generation happen locally
inside Obsidian. Exported images are written to the current vault. Custom font
files are copied to `.xhs-longform/fonts` in the current vault and are only
read when the plugin renders a preview or export.

The plugin makes no network requests at runtime.
