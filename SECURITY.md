# Security policy

Please report security issues privately to the maintainer through GitHub's
private vulnerability reporting feature after the public repository is live.
Do not include private note contents or copyrighted font files in a public issue.

The plugin performs all rendering locally. Optional OFL fonts are downloaded
from a version-pinned path in this repository, SHA-256 verified, and cached
outside the vault. No note contents or imported fonts are transmitted. Users
are responsible for ensuring that fonts they import may be used for their
intended purpose.

The macOS Live Photo feature executes a converter built from the reviewed Swift
source in `prototype/live-photo-macos/LivePhotoTool.swift`. The release embeds a
universal Intel/Apple Silicon build in `main.js`; it is extracted only to a
random temporary directory during an explicit export action. The plugin then
invokes `/usr/bin/osascript` with a fixed script to import the generated pair
into Photos. User text is never executed as a command.
