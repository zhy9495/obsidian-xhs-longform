# macOS Live Photo prototype

This prototype converts a still image and a QuickTime movie into a standards-compliant Live Photo pair and imports it directly into the macOS Photos library.

It uses only Apple system frameworks:

- ImageIO/Core Graphics for the image asset identifier.
- AVFoundation/Core Media for the QuickTime content identifier and still-image-time metadata track.
- Photos automation for importing the completed pair as one Photos asset.

Build:

```bash
./build.sh
```

Run:

```bash
./build/xhs-live-photo cover.png animation.mov output

osascript ImportToPhotos.applescript \
  output/live-photo.jpg output/live-photo.mov
```

The Photos import returns `1` when the JPG and MOV are accepted as one paired asset. For a stronger round-trip check, export that item from Photos with **Export unmodified original**: a valid Live Photo produces both the JPG and MOV resources.

The executable also contains an experimental `--save-to-photos` PhotoKit path. A headless command-line launch cannot reliably receive Photos permission on macOS, so the verified Obsidian integration path is the system Photos import command above.

The metadata structure follows Apple’s public APIs and the documented Live Photo format used by the MIT-licensed [LimitPoint/LivePhoto](https://github.com/LimitPoint/LivePhoto) project.
