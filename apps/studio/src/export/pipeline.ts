import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { demuxMP4, type DemuxedMedia } from "./demuxer";
import { VideoFrameCompositor } from "./compositor";
import type { SubtitleExportData, ExportOptions, ExportProgress } from "./types";

export interface PipelineParams {
  videoBuffer: ArrayBuffer;
  subtitles: SubtitleExportData;
  options?: ExportOptions;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}

export interface PipelineResult {
  buffer: ArrayBuffer;
  duration: number;
  fileSize: number;
  mimeType: string;
}

function calculateBitrate(width: number, height: number, fps: number): number {
  // Balanced high-quality H.264 bitrate calculation
  const bpp = 0.1;
  const calculated = Math.round(width * height * fps * bpp);
  return Math.max(4_000_000, Math.min(25_000_000, calculated));
}

/**
 * Runs the end-to-end client-side video export pipeline.
 */
export async function runExportPipeline(params: PipelineParams): Promise<PipelineResult> {
  const { videoBuffer, subtitles, options, onProgress, signal } = params;

  if (signal?.aborted) {
    throw new Error("Export cancelled by user");
  }

  // 1. Demux MP4
  onProgress?.({
    phase: "demuxing",
    progress: 0.05,
    currentFrame: 0,
    totalFrames: 0,
    fps: 0,
    estimatedRemainingSec: 0,
  });

  const demuxed: DemuxedMedia = await demuxMP4(videoBuffer);
  const { videoTrack, audioTrack, videoSamples, audioSamples } = demuxed;

  if (signal?.aborted) {
    throw new Error("Export cancelled by user");
  }

  if (!videoSamples || videoSamples.length === 0) {
    throw new Error("No video samples found in the media file");
  }

  const width = options?.width ?? videoTrack.width;
  const height = options?.height ?? videoTrack.height;
  const fps = options?.fps ?? videoTrack.fps;
  const totalFrames = videoSamples.length;

  // 2. Setup mp4-muxer
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: "avc",
      width,
      height,
      frameRate: Math.round(fps),
    },
    audio: audioTrack
      ? {
          codec: "aac",
          numberOfChannels: audioTrack.channelCount,
          sampleRate: audioTrack.sampleRate,
        }
      : undefined,
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });

  // 3. Add audio samples (lossless passthrough)
  if (audioTrack && audioSamples.length > 0) {
    for (const sample of audioSamples) {
      const timestampMicros = (sample.cts * 1_000_000) / sample.timescale;
      const durationMicros = (sample.duration * 1_000_000) / sample.timescale;
      muxer.addAudioChunkRaw(
        sample.data,
        sample.is_sync ? "key" : "delta",
        timestampMicros,
        durationMicros,
      );
    }
  }

  // 4. Initialize Subtitle Compositor
  const compositor = new VideoFrameCompositor({
    width,
    height,
    lines: subtitles.lines,
    style: subtitles.style,
    position: subtitles.position,
    animation: subtitles.animation,
  });

  let encoderError: Error | null = null;
  let decoderError: Error | null = null;

  // 5. Initialize VideoEncoder
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (e) => {
      console.error("VideoEncoder error:", e);
      encoderError = new Error(`VideoEncoder error: ${e.message}`);
    },
  });

  const targetBitrate = options?.bitrate ?? calculateBitrate(width, height, fps);
  let encoderCodec = "avc1.4d002a";

  try {
    const support = await VideoEncoder.isConfigSupported({
      codec: encoderCodec,
      width,
      height,
      bitrate: targetBitrate,
      framerate: Math.round(fps),
    });
    if (!support.supported) {
      encoderCodec = "avc1.42001f";
    }
  } catch {
    // Fall back to default
  }

  encoder.configure({
    codec: encoderCodec,
    width,
    height,
    bitrate: targetBitrate,
    framerate: Math.round(fps),
    hardwareAcceleration: "prefer-hardware",
  });

  // 6. Initialize VideoDecoder
  let processedFrames = 0;
  const startTime = performance.now();

  const decoder = new VideoDecoder({
    output: (decodedFrame) => {
      try {
        if (signal?.aborted) {
          decodedFrame.close();
          return;
        }

        // Composite frame + subtitles
        let compositedFrame: VideoFrame | null = null;
        try {
          compositedFrame = compositor.composite(decodedFrame);
        } finally {
          decodedFrame.close();
        }

        if (compositedFrame) {
          try {
            encoder.encode(compositedFrame);
          } finally {
            compositedFrame.close();
          }
        }

        processedFrames++;

        // Calculate progress stats
        const now = performance.now();
        const elapsedSec = (now - startTime) / 1000;
        const currentSpeedFps = elapsedSec > 0 ? processedFrames / elapsedSec : 0;
        const remainingFrames = Math.max(0, totalFrames - processedFrames);
        const estimatedRemainingSec = currentSpeedFps > 0 ? remainingFrames / currentSpeedFps : 0;

        onProgress?.({
          phase: "rendering",
          progress: totalFrames > 0 ? processedFrames / totalFrames : 0,
          currentFrame: processedFrames,
          totalFrames,
          fps: Math.round(currentSpeedFps),
          estimatedRemainingSec: Math.round(estimatedRemainingSec),
        });
      } catch (err) {
        console.error("Error processing decoded frame:", err);
        decoderError = err as Error;
      }
    },
    error: (e) => {
      console.error("VideoDecoder error:", e);
      decoderError = new Error(`VideoDecoder error: ${e.message}`);
    },
  });

  decoder.configure({
    codec: videoTrack.codec,
    description: videoTrack.description || undefined,
    hardwareAcceleration: "prefer-hardware",
  });

  try {
    // 7. Feed chunks to VideoDecoder with backpressure
    for (let i = 0; i < videoSamples.length; i++) {
      if (signal?.aborted) {
        throw new Error("Export cancelled by user");
      }
      if (encoderError) throw encoderError;
      if (decoderError) throw decoderError;

      const sample = videoSamples[i];

      // Backpressure: throttle decoding if encoder queue is backed up
      while (encoder.encodeQueueSize > 5) {
        if (signal?.aborted) throw new Error("Export cancelled by user");
        await new Promise((resolve) => setTimeout(resolve, 8));
      }

      const chunk = new EncodedVideoChunk({
        type: sample.is_sync ? "key" : "delta",
        timestamp: (sample.cts * 1_000_000) / sample.timescale,
        duration: (sample.duration * 1_000_000) / sample.timescale,
        data: sample.data,
      });

      decoder.decode(chunk);
    }

    // 8. Flush decoder and encoder
    await decoder.flush();
    await encoder.flush();

    if (signal?.aborted) {
      throw new Error("Export cancelled by user");
    }

    // 9. Finalize Muxer
    onProgress?.({
      phase: "muxing",
      progress: 0.99,
      currentFrame: totalFrames,
      totalFrames,
      fps: 0,
      estimatedRemainingSec: 0,
    });

    muxer.finalize();
    const finalBuffer = target.buffer;

    onProgress?.({
      phase: "complete",
      progress: 1.0,
      currentFrame: totalFrames,
      totalFrames,
      fps: 0,
      estimatedRemainingSec: 0,
    });

    return {
      buffer: finalBuffer,
      duration: videoTrack.duration,
      fileSize: finalBuffer.byteLength,
      mimeType: "video/mp4",
    };
  } finally {
    // Teardown resources
    try {
      if (decoder.state !== "closed") decoder.close();
      if (encoder.state !== "closed") encoder.close();
      compositor.dispose();
    } catch (e) {
      console.warn("Cleanup error in export pipeline:", e);
    }
  }
}
