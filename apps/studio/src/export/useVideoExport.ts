import { useState, useRef, useCallback } from "react";
import { renderMediaOnWeb } from "@remotion/web-renderer";
import { MainComposition } from "@captionly/engine";
import type { SubtitleCompositionProps } from "@captionly/engine";
import { downloadBlob } from "./downloadBlob";
import { FPS } from "@/lib/constants";
import type { SubtitleExportData, ExportProgress } from "./types";

export interface UseVideoExportReturn {
  isSupported: boolean;
  isExporting: boolean;
  progress: ExportProgress | null;
  error: string | null;
  exportVideo: (
    videoSource: File | Blob | string,
    subtitles: SubtitleExportData,
    durationSec: number,
    width: number,
    height: number,
  ) => Promise<Blob | null>;
  cancelExport: () => void;
  downloadBlob: (blob: Blob, filename?: string) => void;
}

export function useVideoExport(): UseVideoExportReturn {
  const [isSupported] = useState<boolean>(
    typeof window !== "undefined" && "VideoEncoder" in window && "VideoDecoder" in window,
  );
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const cancelExport = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsExporting(false);
    setProgress(null);
    setError(null);
  }, []);

  const exportVideo = useCallback(
    async (
      videoSource: File | Blob | string,
      subtitles: SubtitleExportData,
      durationSec: number,
      width: number,
      height: number,
    ): Promise<Blob | null> => {
      if (!isSupported) {
        const msg =
          "In-browser video export is not supported in this browser. Please use Chrome 94+, Edge 94+, or Safari 16.4+.";
        setError(msg);
        throw new Error(msg);
      }

      // Remotion's <Video> component needs a URL string — create a blob URL if
      // the caller provided a File or Blob.
      let videoUrl: string;
      let blobUrlToRevoke: string | null = null;

      if (typeof videoSource === "string") {
        videoUrl = videoSource;
      } else {
        videoUrl = URL.createObjectURL(videoSource);
        blobUrlToRevoke = videoUrl;
      }

      const durationInFrames = Math.max(1, Math.ceil(durationSec * FPS));
      const abort = new AbortController();
      abortRef.current = abort;

      setIsExporting(true);
      setError(null);
      setProgress({
        phase: "rendering",
        progress: 0,
        currentFrame: 0,
        totalFrames: durationInFrames,
        fps: 0,
        estimatedRemainingSec: 0,
      });

      const startTime = performance.now();

      try {
        const inputProps: SubtitleCompositionProps = {
          videoSrc: videoUrl,
          subtitles,
        };

        const { getBlob } = await renderMediaOnWeb({
          composition: {
            component: MainComposition as unknown as React.ComponentType<Record<string, unknown>>,
            id: "MainComposition",
            durationInFrames,
            fps: FPS,
            width,
            height,
          },
          videoBitrate: "high",
          hardwareAcceleration: "prefer-hardware",
          inputProps: inputProps as unknown as Record<string, unknown>,
          signal: abort.signal,
          onProgress: ({ renderedFrames, progress: overallProgress }) => {
            const elapsedSec = (performance.now() - startTime) / 1000;
            const renderFps = elapsedSec > 0 ? Math.round(renderedFrames / elapsedSec) : 0;

            setProgress({
              phase: "rendering",
              progress: overallProgress,
              currentFrame: renderedFrames,
              totalFrames: durationInFrames,
              fps: renderFps,
              estimatedRemainingSec:
                overallProgress > 0 && elapsedSec > 0
                  ? Math.max(0, Math.round(elapsedSec / overallProgress - elapsedSec))
                  : 0,
            });
          },
        });

        const blob = await getBlob();

        setIsExporting(false);
        setProgress({
          phase: "complete",
          progress: 1.0,
          currentFrame: durationInFrames,
          totalFrames: durationInFrames,
          fps: 0,
          estimatedRemainingSec: 0,
        });

        return blob;
      } catch (err: unknown) {
        setIsExporting(false);
        if ((err as Error).name === "AbortError") {
          return null;
        }
        const msg = (err as Error).message || "Client export failed";
        setError(msg);
        throw err;
      } finally {
        abortRef.current = null;
        if (blobUrlToRevoke) {
          URL.revokeObjectURL(blobUrlToRevoke);
        }
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
