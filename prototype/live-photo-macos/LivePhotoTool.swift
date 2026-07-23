import AVFoundation
import CoreGraphics
import CoreImage
import CoreMedia
import CoreVideo
import Foundation
import ImageIO
import Photos
import UniformTypeIdentifiers

enum LivePhotoToolError: LocalizedError {
    case usage
    case imageReadFailed
    case imageWriteFailed
    case missingVideoTrack
    case readerStartFailed(String)
    case writerStartFailed(String)
    case writerFailed(String)
    case photosPermissionDenied
    case photosSaveFailed(String)
    case savedAssetIsNotLivePhoto
    case motionCompositionFailed(String)

    var errorDescription: String? {
        switch self {
        case .usage:
            return "用法：xhs-live-photo <封面图片> <视频> <输出目录> [--save-to-photos]"
        case .imageReadFailed:
            return "无法读取封面图片"
        case .imageWriteFailed:
            return "无法写入带实况标识的 JPEG"
        case .missingVideoTrack:
            return "输入文件没有视频轨道"
        case .readerStartFailed(let message):
            return "无法读取视频：\(message)"
        case .writerStartFailed(let message):
            return "无法开始写入 MOV：\(message)"
        case .writerFailed(let message):
            return "MOV 写入失败：\(message)"
        case .photosPermissionDenied:
            return "没有获得照片库添加权限"
        case .photosSaveFailed(let message):
            return "保存到照片库失败：\(message)"
        case .savedAssetIsNotLivePhoto:
            return "照片库已创建资源，但没有将它识别为 Live Photo"
        case .motionCompositionFailed(let message):
            return "无法合成动态页面：\(message)"
        }
    }
}

struct CompositionRect {
    let x: CGFloat
    let y: CGFloat
    let width: CGFloat
    let height: CGFloat
}

struct Arguments {
    let imageURL: URL
    let videoURL: URL
    let outputDirectory: URL
    let saveToPhotos: Bool
    let compositionRect: CompositionRect?

    init(_ values: [String]) throws {
        guard values.count >= 4 else { throw LivePhotoToolError.usage }
        imageURL = URL(fileURLWithPath: values[1]).standardizedFileURL
        videoURL = URL(fileURLWithPath: values[2]).standardizedFileURL
        outputDirectory = URL(fileURLWithPath: values[3], isDirectory: true).standardizedFileURL
        saveToPhotos = values.dropFirst(4).contains("--save-to-photos")
        if let composeIndex = values.firstIndex(of: "--compose") {
            guard values.count > composeIndex + 4,
                  let x = Double(values[composeIndex + 1]),
                  let y = Double(values[composeIndex + 2]),
                  let width = Double(values[composeIndex + 3]),
                  let height = Double(values[composeIndex + 4]),
                  width > 0,
                  height > 0
            else { throw LivePhotoToolError.usage }
            compositionRect = CompositionRect(
                x: CGFloat(x),
                y: CGFloat(y),
                width: CGFloat(width),
                height: CGFloat(height)
            )
        } else {
            compositionRect = nil
        }
    }
}

final class LivePhotoPairWriter {
    private let identifier = UUID().uuidString

    func createPair(
        imageURL: URL,
        videoURL: URL,
        outputDirectory: URL,
        compositionRect: CompositionRect? = nil
    ) throws -> (photo: URL, video: URL) {
        try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
        let photoURL = outputDirectory.appendingPathComponent("live-photo.jpg")
        let pairedVideoURL = outputDirectory.appendingPathComponent("live-photo.mov")
        let composedVideoURL = outputDirectory.appendingPathComponent("composed-source.mov")
        try? FileManager.default.removeItem(at: photoURL)
        try? FileManager.default.removeItem(at: pairedVideoURL)
        try? FileManager.default.removeItem(at: composedVideoURL)
        try writePairedImage(from: imageURL, to: photoURL)
        let sourceVideoURL: URL
        if let compositionRect {
            try MotionPageComposer().compose(
                coverURL: imageURL,
                motionURL: videoURL,
                rect: compositionRect,
                destinationURL: composedVideoURL
            )
            sourceVideoURL = composedVideoURL
        } else {
            sourceVideoURL = videoURL
        }
        try writePairedVideo(from: sourceVideoURL, to: pairedVideoURL)
        try? FileManager.default.removeItem(at: composedVideoURL)
        return (photoURL, pairedVideoURL)
    }

    private func writePairedImage(from sourceURL: URL, to destinationURL: URL) throws {
        guard
            let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
            let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
            let destination = CGImageDestinationCreateWithURL(
                destinationURL as CFURL,
                UTType.jpeg.identifier as CFString,
                1,
                nil
            )
        else { throw LivePhotoToolError.imageReadFailed }

        var properties = (CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]) ?? [:]
        var makerApple = properties[kCGImagePropertyMakerAppleDictionary] as? [String: Any] ?? [:]
        makerApple["17"] = identifier
        properties[kCGImagePropertyMakerAppleDictionary] = makerApple
        properties[kCGImageDestinationLossyCompressionQuality] = 1.0
        CGImageDestinationAddImage(destination, image, properties as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { throw LivePhotoToolError.imageWriteFailed }
    }

    private func writePairedVideo(from sourceURL: URL, to destinationURL: URL) throws {
        let asset = AVURLAsset(url: sourceURL)
        guard let videoTrack = asset.tracks(withMediaType: .video).first else {
            throw LivePhotoToolError.missingVideoTrack
        }
        let reader = try AVAssetReader(asset: asset)
        let readerOutput = AVAssetReaderTrackOutput(track: videoTrack, outputSettings: nil)
        guard reader.canAdd(readerOutput) else {
            throw LivePhotoToolError.readerStartFailed("不支持该视频轨道")
        }
        reader.add(readerOutput)

        let writer = try AVAssetWriter(outputURL: destinationURL, fileType: .mov)
        guard let rawSourceFormat = videoTrack.formatDescriptions.first else {
            throw LivePhotoToolError.writerStartFailed("缺少视频格式信息")
        }
        let sourceFormat = rawSourceFormat as! CMFormatDescription
        let videoInput = AVAssetWriterInput(
            mediaType: .video,
            outputSettings: nil,
            sourceFormatHint: sourceFormat
        )
        videoInput.transform = videoTrack.preferredTransform
        guard writer.canAdd(videoInput) else {
            throw LivePhotoToolError.writerStartFailed("无法添加视频轨道")
        }
        writer.add(videoInput)

        let metadataAdaptor = makeStillImageTimeAdaptor()
        guard writer.canAdd(metadataAdaptor.assetWriterInput) else {
            throw LivePhotoToolError.writerStartFailed("无法添加实况关键帧轨道")
        }
        writer.add(metadataAdaptor.assetWriterInput)
        writer.metadata = [makeAssetIdentifierMetadata()]

        guard writer.startWriting() else {
            throw LivePhotoToolError.writerStartFailed(writer.error?.localizedDescription ?? "未知错误")
        }
        guard reader.startReading() else {
            throw LivePhotoToolError.readerStartFailed(reader.error?.localizedDescription ?? "未知错误")
        }
        writer.startSession(atSourceTime: .zero)

        let durationSeconds = max(0.1, CMTimeGetSeconds(asset.duration))
        let coverStart = CMTime(seconds: durationSeconds / 2, preferredTimescale: 600)
        let coverDuration = CMTime(value: 1, timescale: 30)
        guard metadataAdaptor.append(
            AVTimedMetadataGroup(
                items: [makeStillImageTimeMetadata()],
                timeRange: CMTimeRange(start: coverStart, duration: coverDuration)
            )
        ) else {
            throw LivePhotoToolError.writerStartFailed("无法写入实况封面时间")
        }
        metadataAdaptor.assetWriterInput.markAsFinished()

        let semaphore = DispatchSemaphore(value: 0)
        let queue = DispatchQueue(label: "com.ying.xhs-live-photo.video-writer")
        videoInput.requestMediaDataWhenReady(on: queue) {
            while videoInput.isReadyForMoreMediaData {
                guard let sample = readerOutput.copyNextSampleBuffer() else {
                    videoInput.markAsFinished()
                    writer.finishWriting { semaphore.signal() }
                    return
                }
                if !videoInput.append(sample) {
                    reader.cancelReading()
                    videoInput.markAsFinished()
                    writer.cancelWriting()
                    semaphore.signal()
                    return
                }
            }
        }
        semaphore.wait()

        guard writer.status == .completed else {
            throw LivePhotoToolError.writerFailed(writer.error?.localizedDescription ?? "状态 \(writer.status.rawValue)")
        }
    }

    private func makeAssetIdentifierMetadata() -> AVMetadataItem {
        let item = AVMutableMetadataItem()
        item.keySpace = AVMetadataKeySpace(rawValue: "mdta")
        item.key = "com.apple.quicktime.content.identifier" as NSString
        item.value = identifier as NSString
        item.dataType = "com.apple.metadata.datatype.UTF-8"
        return item
    }

    private func makeStillImageTimeAdaptor() -> AVAssetWriterInputMetadataAdaptor {
        let specification: NSDictionary = [
            kCMMetadataFormatDescriptionMetadataSpecificationKey_Identifier as NSString:
                "mdta/com.apple.quicktime.still-image-time",
            kCMMetadataFormatDescriptionMetadataSpecificationKey_DataType as NSString:
                "com.apple.metadata.datatype.int8"
        ]
        var description: CMFormatDescription?
        CMMetadataFormatDescriptionCreateWithMetadataSpecifications(
            allocator: kCFAllocatorDefault,
            metadataType: kCMMetadataFormatType_Boxed,
            metadataSpecifications: [specification] as CFArray,
            formatDescriptionOut: &description
        )
        let input = AVAssetWriterInput(mediaType: .metadata, outputSettings: nil, sourceFormatHint: description)
        return AVAssetWriterInputMetadataAdaptor(assetWriterInput: input)
    }

    private func makeStillImageTimeMetadata() -> AVMetadataItem {
        let item = AVMutableMetadataItem()
        item.keySpace = AVMetadataKeySpace(rawValue: "mdta")
        item.key = "com.apple.quicktime.still-image-time" as NSString
        item.value = NSNumber(value: 0)
        item.dataType = "com.apple.metadata.datatype.int8"
        return item
    }
}

final class MotionPageComposer {
    private let canvasSize = CGSize(width: 1080, height: 1440)
    private let context = CIContext(options: [.cacheIntermediates: false])

    func compose(coverURL: URL, motionURL: URL, rect: CompositionRect, destinationURL: URL) throws {
        guard
            let coverSource = CGImageSourceCreateWithURL(coverURL as CFURL, nil),
            let coverImage = CGImageSourceCreateImageAtIndex(coverSource, 0, nil)
        else { throw LivePhotoToolError.imageReadFailed }
        let cover = CIImage(cgImage: coverImage)
        if motionURL.pathExtension.lowercased() == "gif" {
            try composeGIF(sourceURL: motionURL, cover: cover, rect: rect, destinationURL: destinationURL)
        } else {
            try composeVideo(sourceURL: motionURL, cover: cover, rect: rect, destinationURL: destinationURL)
        }
    }

    private func composeVideo(
        sourceURL: URL,
        cover: CIImage,
        rect: CompositionRect,
        destinationURL: URL
    ) throws {
        let asset = AVURLAsset(url: sourceURL)
        guard let track = asset.tracks(withMediaType: .video).first else {
            throw LivePhotoToolError.missingVideoTrack
        }
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(
            track: track,
            outputSettings: [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
            ]
        )
        output.alwaysCopiesSampleData = false
        guard reader.canAdd(output) else {
            throw LivePhotoToolError.motionCompositionFailed("无法读取视频画面")
        }
        reader.add(output)
        let writer = try makeWriter(destinationURL: destinationURL)
        guard reader.startReading() else {
            throw LivePhotoToolError.readerStartFailed(reader.error?.localizedDescription ?? "未知错误")
        }
        writer.writer.startWriting()
        writer.writer.startSession(atSourceTime: .zero)
        var firstTimestamp: CMTime?
        var appended = false
        while let sample = output.copyNextSampleBuffer() {
            guard let sourceBuffer = CMSampleBufferGetImageBuffer(sample) else { continue }
            let timestamp = CMSampleBufferGetPresentationTimeStamp(sample)
            if firstTimestamp == nil { firstTimestamp = timestamp }
            let presentationTime = CMTimeSubtract(timestamp, firstTimestamp ?? .zero)
            var source = CIImage(cvPixelBuffer: sourceBuffer).transformed(by: track.preferredTransform)
            source = source.transformed(by: CGAffineTransform(
                translationX: -source.extent.minX,
                y: -source.extent.minY
            ))
            try append(
                source: source,
                cover: cover,
                rect: rect,
                at: presentationTime,
                writer: writer
            )
            appended = true
        }
        guard appended else {
            throw LivePhotoToolError.motionCompositionFailed("视频中没有可用画面")
        }
        try finish(writer)
    }

    private func composeGIF(
        sourceURL: URL,
        cover: CIImage,
        rect: CompositionRect,
        destinationURL: URL
    ) throws {
        guard let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil) else {
            throw LivePhotoToolError.motionCompositionFailed("无法读取 GIF")
        }
        let count = CGImageSourceGetCount(source)
        guard count > 0 else {
            throw LivePhotoToolError.motionCompositionFailed("GIF 中没有画面")
        }
        var frames: [(CIImage, Double)] = []
        for index in 0..<count {
            guard let image = CGImageSourceCreateImageAtIndex(source, index, nil) else { continue }
            frames.append((CIImage(cgImage: image), gifDelay(source: source, index: index)))
        }
        guard !frames.isEmpty else {
            throw LivePhotoToolError.motionCompositionFailed("GIF 中没有可用画面")
        }
        let cycleDuration = frames.reduce(0) { $0 + $1.1 }
        let repeats = cycleDuration > 0 ? max(1, min(20, Int(ceil(2.0 / cycleDuration)))) : 1
        let writer = try makeWriter(destinationURL: destinationURL)
        writer.writer.startWriting()
        writer.writer.startSession(atSourceTime: .zero)
        var elapsed = 0.0
        for _ in 0..<repeats {
            for (frame, delay) in frames {
                try append(
                    source: frame,
                    cover: cover,
                    rect: rect,
                    at: CMTime(seconds: elapsed, preferredTimescale: 600),
                    writer: writer
                )
                elapsed += delay
            }
        }
        try finish(writer)
    }

    private func gifDelay(source: CGImageSource, index: Int) -> Double {
        guard
            let properties = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any],
            let gif = properties[kCGImagePropertyGIFDictionary] as? [CFString: Any]
        else { return 0.1 }
        let unclamped = gif[kCGImagePropertyGIFUnclampedDelayTime] as? Double
        let clamped = gif[kCGImagePropertyGIFDelayTime] as? Double
        return max(0.02, unclamped ?? clamped ?? 0.1)
    }

    private typealias WriterParts = (
        writer: AVAssetWriter,
        input: AVAssetWriterInput,
        adaptor: AVAssetWriterInputPixelBufferAdaptor
    )

    private func makeWriter(destinationURL: URL) throws -> WriterParts {
        try? FileManager.default.removeItem(at: destinationURL)
        let writer = try AVAssetWriter(outputURL: destinationURL, fileType: .mov)
        let input = AVAssetWriterInput(
            mediaType: .video,
            outputSettings: [
                AVVideoCodecKey: AVVideoCodecType.h264,
                AVVideoWidthKey: Int(canvasSize.width),
                AVVideoHeightKey: Int(canvasSize.height),
                AVVideoCompressionPropertiesKey: [
                    AVVideoAverageBitRateKey: 8_000_000,
                    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
                ]
            ]
        )
        input.expectsMediaDataInRealTime = false
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: input,
            sourcePixelBufferAttributes: [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                kCVPixelBufferWidthKey as String: Int(canvasSize.width),
                kCVPixelBufferHeightKey as String: Int(canvasSize.height),
                kCVPixelBufferIOSurfacePropertiesKey as String: [:]
            ]
        )
        guard writer.canAdd(input) else {
            throw LivePhotoToolError.motionCompositionFailed("无法创建视频编码器")
        }
        writer.add(input)
        return (writer, input, adaptor)
    }

    private func append(
        source: CIImage,
        cover: CIImage,
        rect: CompositionRect,
        at time: CMTime,
        writer: WriterParts
    ) throws {
        while !writer.input.isReadyForMoreMediaData {
            if writer.writer.status == .failed {
                throw LivePhotoToolError.motionCompositionFailed(
                    writer.writer.error?.localizedDescription ?? "视频编码失败"
                )
            }
            Thread.sleep(forTimeInterval: 0.002)
        }
        guard let pool = writer.adaptor.pixelBufferPool else {
            throw LivePhotoToolError.motionCompositionFailed("无法创建视频帧缓冲区")
        }
        var outputBuffer: CVPixelBuffer?
        guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &outputBuffer) == kCVReturnSuccess,
              let outputBuffer
        else { throw LivePhotoToolError.motionCompositionFailed("无法分配视频帧") }
        let composed = composeFrame(source: source, cover: cover, rect: rect)
        context.render(
            composed,
            to: outputBuffer,
            bounds: CGRect(origin: .zero, size: canvasSize),
            colorSpace: CGColorSpaceCreateDeviceRGB()
        )
        guard writer.adaptor.append(outputBuffer, withPresentationTime: time) else {
            throw LivePhotoToolError.motionCompositionFailed(
                writer.writer.error?.localizedDescription ?? "无法写入视频帧"
            )
        }
    }

    private func composeFrame(source: CIImage, cover: CIImage, rect: CompositionRect) -> CIImage {
        let target = CGRect(
            x: rect.x,
            y: canvasSize.height - rect.y - rect.height,
            width: rect.width,
            height: rect.height
        )
        let normalized = source.transformed(by: CGAffineTransform(
            translationX: -source.extent.minX,
            y: -source.extent.minY
        ))
        let scale = max(target.width / normalized.extent.width, target.height / normalized.extent.height)
        var placed = normalized.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        placed = placed.transformed(by: CGAffineTransform(
            translationX: target.midX - placed.extent.midX,
            y: target.midY - placed.extent.midY
        ))
        placed = placed.cropped(to: target)
        return placed
            .composited(over: cover)
            .cropped(to: CGRect(origin: .zero, size: canvasSize))
    }

    private func finish(_ writer: WriterParts) throws {
        writer.input.markAsFinished()
        let semaphore = DispatchSemaphore(value: 0)
        writer.writer.finishWriting { semaphore.signal() }
        semaphore.wait()
        guard writer.writer.status == .completed else {
            throw LivePhotoToolError.motionCompositionFailed(
                writer.writer.error?.localizedDescription ?? "视频写入失败"
            )
        }
    }
}

func requestAddOnlyPhotosAuthorization() throws {
    let semaphore = DispatchSemaphore(value: 0)
    var authorizationStatus: PHAuthorizationStatus = .notDetermined
    PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
        authorizationStatus = status
        semaphore.signal()
    }
    semaphore.wait()
    guard authorizationStatus == .authorized || authorizationStatus == .limited else {
        throw LivePhotoToolError.photosPermissionDenied
    }
}

func saveToPhotos(photoURL: URL, videoURL: URL) throws -> String {
    try requestAddOnlyPhotosAuthorization()
    var localIdentifier: String?
    do {
        try PHPhotoLibrary.shared().performChangesAndWait {
            let request = PHAssetCreationRequest.forAsset()
            let options = PHAssetResourceCreationOptions()
            options.shouldMoveFile = false
            request.addResource(with: .photo, fileURL: photoURL, options: options)
            request.addResource(with: .pairedVideo, fileURL: videoURL, options: options)
            localIdentifier = request.placeholderForCreatedAsset?.localIdentifier
        }
    } catch {
        throw LivePhotoToolError.photosSaveFailed(error.localizedDescription)
    }
    guard let localIdentifier else {
        throw LivePhotoToolError.photosSaveFailed("没有返回照片资源标识")
    }
    let result = PHAsset.fetchAssets(withLocalIdentifiers: [localIdentifier], options: nil)
    guard let asset = result.firstObject, asset.mediaSubtypes.contains(.photoLive) else {
        throw LivePhotoToolError.savedAssetIsNotLivePhoto
    }
    return localIdentifier
}

do {
    let arguments = try Arguments(CommandLine.arguments)
    let resources = try LivePhotoPairWriter().createPair(
        imageURL: arguments.imageURL,
        videoURL: arguments.videoURL,
        outputDirectory: arguments.outputDirectory,
        compositionRect: arguments.compositionRect
    )
    print("PHOTO=\(resources.photo.path)")
    print("VIDEO=\(resources.video.path)")
    if arguments.saveToPhotos {
        let localIdentifier = try saveToPhotos(photoURL: resources.photo, videoURL: resources.video)
        print("PHOTOS_ASSET=\(localIdentifier)")
        print("LIVE_PHOTO=verified")
    }
} catch {
    fputs("ERROR: \(error.localizedDescription)\n", stderr)
    exit(1)
}
