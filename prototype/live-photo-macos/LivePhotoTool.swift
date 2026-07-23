import AVFoundation
import CoreGraphics
import CoreMedia
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
        }
    }
}

struct Arguments {
    let imageURL: URL
    let videoURL: URL
    let outputDirectory: URL
    let saveToPhotos: Bool

    init(_ values: [String]) throws {
        guard values.count >= 4 else { throw LivePhotoToolError.usage }
        imageURL = URL(fileURLWithPath: values[1]).standardizedFileURL
        videoURL = URL(fileURLWithPath: values[2]).standardizedFileURL
        outputDirectory = URL(fileURLWithPath: values[3], isDirectory: true).standardizedFileURL
        saveToPhotos = values.dropFirst(4).contains("--save-to-photos")
    }
}

final class LivePhotoPairWriter {
    private let identifier = UUID().uuidString

    func createPair(imageURL: URL, videoURL: URL, outputDirectory: URL) throws -> (photo: URL, video: URL) {
        try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
        let photoURL = outputDirectory.appendingPathComponent("live-photo.jpg")
        let pairedVideoURL = outputDirectory.appendingPathComponent("live-photo.mov")
        try? FileManager.default.removeItem(at: photoURL)
        try? FileManager.default.removeItem(at: pairedVideoURL)
        try writePairedImage(from: imageURL, to: photoURL)
        try writePairedVideo(from: videoURL, to: pairedVideoURL)
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
        outputDirectory: arguments.outputDirectory
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
