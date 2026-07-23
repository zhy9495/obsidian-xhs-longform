#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
OUTPUT_DIR="$SCRIPT_DIR/build"
APP_DIR="$OUTPUT_DIR/XHS Live Photo Prototype.app"
mkdir -p "$OUTPUT_DIR"

swiftc \
  -swift-version 5 \
  -O \
  -module-cache-path "$OUTPUT_DIR/module-cache" \
  -framework AVFoundation \
  -framework CoreMedia \
  -framework CoreGraphics \
  -framework ImageIO \
  -framework Photos \
  -framework UniformTypeIdentifiers \
  -Xlinker -sectcreate \
  -Xlinker __TEXT \
  -Xlinker __info_plist \
  -Xlinker "$SCRIPT_DIR/Info.plist" \
  "$SCRIPT_DIR/LivePhotoTool.swift" \
  -o "$OUTPUT_DIR/xhs-live-photo"

rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
cp "$OUTPUT_DIR/xhs-live-photo" "$APP_DIR/Contents/MacOS/xhs-live-photo"
cp "$SCRIPT_DIR/Info.plist" "$APP_DIR/Contents/Info.plist"
codesign --force --sign - "$APP_DIR"

echo "$APP_DIR"
