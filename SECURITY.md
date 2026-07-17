# Security policy

Please report security issues privately to the maintainer through GitHub's
private vulnerability reporting feature after the public repository is live.
Do not include private note contents or copyrighted font files in a public issue.

The plugin performs all rendering locally. Optional OFL fonts are downloaded
from a version-pinned path in this repository, SHA-256 verified, and cached
outside the vault. No note contents or imported fonts are transmitted. Users
are responsible for ensuring that fonts they import may be used for their
intended purpose.
