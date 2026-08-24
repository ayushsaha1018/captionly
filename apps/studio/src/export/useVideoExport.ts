import { useState, useRef, useCallback, useEffect } from "react";
import { convertMedia, webcodecsController, type WebCodecsController } from "@remotion/webcodecs";
import { drawSubtitlesOnCanvas } from "./subtitleDrawer";
import { downloadBlob } from "./downloadBlob";
import type { SubtitleExportData, ExportOptions, ExportProgress } from "./types";

export interface UseVideoExportReturn {
  isSupported: boolean;
  isExporting: boolean;
  progress: ExportProgress | null;
  error: string | null;
  exportVideo: (
    videoSource: File | Blob | string,
    subtitles: SubtitleExportData,
    options?: ExportOptions,
  ) => Promise<Blob | null>;
  cancelExport: () => void;
  downloadBlob: (blob: Blob, filename?: string) => void;
}

export function isBrowserExportSupported(): boolean {
  return typeof window !== "undefined" && "VideoEncoder" in window && "VideoDecoder" in window;
}

export function useVideoExport(): UseVideoExportReturn {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const controllerRef = useRef<WebCodecsController | null>(null);

  useEffect(() => {
    setIsSupported(isBrowserExportSupported());
  }, []);

  const cancelExport = useCallback(() => {
    if (controllerRef.current) {
      try {
        controllerRef.current.abort();
      } catch (err) {
        console.warn("Error aborting export controller:", err);
      }
      controllerRef.current = null;
    }
    setIsExporting(false);
    setProgress(null);
    setError(null);
  }, []);

  const exportVideo = useCallback(
    async (
      videoSource: File | Blob | string,
      subtitles: SubtitleExportData,
    ): Promise<Blob | null> => {
      if (!isSupported) {
        const err = new Error(
          "In-browser video export is not supported in this browser. Please use Chrome 94+, Edge 94+, or Safari 16.4+.",
        );
        setError(err.message);
        throw err;
      }

      setIsExporting(true);
      setError(null);
      setProgress({
        phase: "demuxing",
        progress: 0,
        currentFrame: 0,
        totalFrames: 0,
        fps: 0,
        estimatedRemainingSec: 0,
      });

      const controller = webcodecsController();
      controllerRef.current = controller;

      let canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
      let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;
      const startTime = performance.now();

      try {
        const result = await convertMedia({
          src: videoSource,
          container: "mp4",
          videoCodec: "h264",
          audioCodec: "aac",
          controller,
          onVideoTrack: ({ defaultVideoCodec }) => {
            return {
              type: "reencode",
              videoCodec: defaultVideoCodec || "h264",
            };
          },
          onAudioTrack: () => {
            return {
              type: "copy",
            };
          },
          onVideoFrame: ({ frame }) => {
            const width = frame.displayWidth || frame.codedWidth;
            const height = frame.displayHeight || frame.codedHeight;

            if (!canvas || canvas.width !== width || canvas.height !== height) {
              if (typeof OffscreenCanvas !== "undefined") {
                canvas = new OffscreenCanvas(width, height);
                ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
              } else {
                canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                ctx = canvas.getContext("2d", { alpha: false });
              }
            }

            if (!ctx) {
              return frame;
            }

            const timestamp = frame.timestamp;
            const duration = frame.duration ?? 0;
            const timeInSec = timestamp / 1_000_000;

            // 1. Draw source video frame
            ctx.drawImage(frame as unknown as CanvasImageSource, 0, 0, width, height);

            // 2. Draw animated subtitles onto video
            drawSubtitlesOnCanvas({
              ctx,
              subtitles,
              timeInSeconds: timeInSec,
              width,
              height,
            });

            // 3. Create composited frame with exact timestamps & duration
            const compositedFrame = new VideoFrame(canvas as unknown as CanvasImageSource, {
              timestamp,
              duration,
              alpha: "discard",
            });

            return compositedFrame;
          },
          onProgress: (state) => {
            const currentFrame = state.encodedVideoFrames || state.decodedVideoFrames || 0;
            const elapsedSec = (performance.now() - startTime) / 1000;
            const fps = elapsedSec > 0 ? Math.round(currentFrame / elapsedSec) : 0;
            const overallProgress = state.overallProgress ?? 0;

            setProgress({
              phase: "rendering",
              progress: overallProgress,
              currentFrame,
              totalFrames: state.expectedOutputDurationInMs
                ? Math.round((state.expectedOutputDurationInMs / 1000) * 30)
                : currentFrame,
              fps,
              estimatedRemainingSec:
                overallProgress > 0 && elapsedSec > 0
                  ? Math.max(0, Math.round(elapsedSec / overallProgress - elapsedSec))
                  : 0,
            });
          },
        });

        const outputBlob = await result.save();

        setIsExporting(false);
        setProgress({
          phase: "complete",
          progress: 1.0,
          currentFrame: 0,
          totalFrames: 0,
          fps: 0,
          estimatedRemainingSec: 0,
        });

        controllerRef.current = null;
        return outputBlob;
      } catch (err: unknown) {
        setIsExporting(false);
        controllerRef.current = null;
        const errorMsg = (err as Error).message || "Failed during video export";
        setError(errorMsg);
        throw err;
      }
    },
    [isSupported],
  );

  return {
    isSupported,
    isExporting,
    progress,
    error,
    exportVideo,
    cancelExport,
    downloadBlob,
  };
}
