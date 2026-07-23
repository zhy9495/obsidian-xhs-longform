#!/bin/zsh
set -euo pipefail

ROOT_DIR=${0:A:h:h}
SOURCE="$ROOT_DIR/prototype/live-photo-macos/LivePhotoTool.swift"
BUILD_DIR="$ROOT_DIR/assets/live-photo-build"
OUTPUT="$ROOT_DIR/assets/xhs-live-photo.live-photo-tool"

mkdir -p "$BUILD_DIR"

swiftc \
  -swift-version 5 \
  -O \
  -target arm64-apple-macosx11.0 \
  -module-cache-path "$BUILD_DIR/module-arm64" \
  -framework AVFoundation \
  -framework CoreMedia \
  -framework CoreGraphics \
  -framework ImageIO \
  -framework Photos \
  -framework UniformTypeIdentifiers \
  "$SOURCE" \
  -o "$BUILD_DIR/xhs-live-photo-arm64"

swiftc \
  -swift-version 5 \
  -O \
  -target x86_64-apple-macosx11.0 \
  -module-cache-path "$BUILD_DIR/module-x86_64" \
  -framework AVFoundation \
  -framework CoreMedia \
  -framework CoreGraphics \
  -framework ImageIO \
  -framework Photos \
  -framework UniformTypeIdentifiers \
  "$SOURCE" \
  -o "$BUILD_DIR/xhs-live-photo-x86_64"

lipo -create \
  "$BUILD_DIR/xhs-live-photo-arm64" \
  "$BUILD_DIR/xhs-live-photo-x86_64" \
  -output "$OUTPUT"

chmod +x "$OUTPUT"
file "$OUTPUT"
