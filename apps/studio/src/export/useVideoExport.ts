import { useState, useRef, useCallback, useEffect } from "react";
import type {
  SubtitleExportData,
  ExportOptions,
  ExportProgress,
  MainToWorkerMessage,
  WorkerToMainMessage,
} from "./types";

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
  return (
    typeof window !== "undefined" &&
    "VideoEncoder" in window &&
    "VideoDecoder" in window &&
    "OffscreenCanvas" in window
  );
}

export function useVideoExport(): UseVideoExportReturn {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsSupported(isBrowserExportSupported());
  }, []);

  const workerRef = useRef<Worker | null>(null);
  const resolvePromiseRef = useRef<((blob: Blob | null) => void) | null>(null);
  const rejectPromiseRef = useRef<((err: Error) => void) | null>(null);

  // Terminate worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const cancelExport = useCallback(() => {
    if (workerRef.current) {
      const cancelMsg: MainToWorkerMessage = { type: "CANCEL_EXPORT" };
      workerRef.current.postMessage(cancelMsg);
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsExporting(false);
    setProgress(null);
    setError(null);
    if (resolvePromiseRef.current) {
      resolvePromiseRef.current(null);
      resolvePromiseRef.current = null;
    }
  }, []);

  const downloadBlob = useCallback((blob: Blob, filename = "captionly-video.mp4") => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, []);

  const exportVideo = useCallback(
    async (
      videoSource: File | Blob | string,
      subtitles: SubtitleExportData,
      options?: ExportOptions,
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

      // 1. Fetch / extract ArrayBuffer before entering the Promise constructor
      let videoBuffer: ArrayBuffer;
      try {
        if (typeof videoSource === "string") {
          const res = await fetch(videoSource);
          if (!res.ok) {
            throw new Error(`Failed to load video from URL: ${res.statusText}`);
          }
          videoBuffer = await res.arrayBuffer();
        } else {
          videoBuffer = await videoSource.arrayBuffer();
        }
      } catch (err: unknown) {
        setIsExporting(false);
        const errorMsg = (err as Error).message || "Failed to load video data";
        setError(errorMsg);
        throw err;
      }

      return new Promise<Blob | null>((resolve, reject) => {
        resolvePromiseRef.current = resolve;
        rejectPromiseRef.current = reject;

        try {
          // 2. Instantiate Vite Web Worker
          if (workerRef.current) {
            workerRef.current.terminate();
          }

          const worker = new Worker(new URL("./export.worker.ts", import.meta.url), {
            type: "module",
          });
          workerRef.current = worker;

          worker.onmessage = (e: MessageEvent<WorkerToMainMessage>) => {
            const msg = e.data;

            if (msg.type === "PROGRESS") {
              setProgress(msg.data);
            } else if (msg.type === "COMPLETE") {
              const blob = new Blob([msg.buffer], { type: msg.mimeType });
              setIsExporting(false);
              setProgress({
                phase: "complete",
                progress: 1.0,
                currentFrame: 0,
                totalFrames: 0,
                fps: 0,
                estimatedRemainingSec: 0,
              });

              if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
              }

              resolve(blob);
            } else if (msg.type === "ERROR") {
              setIsExporting(false);
              setError(msg.message);
              if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
              }
              reject(new Error(msg.message));
            }
          };

          worker.onerror = (err) => {
            setIsExporting(false);
            const msg = `Worker error: ${err.message || "Unknown worker error"}`;
            setError(msg);
            if (workerRef.current) {
              workerRef.current.terminate();
              workerRef.current = null;
            }
            reject(new Error(msg));
          };

          // 3. Post start message with transferable ArrayBuffer
          const startMsg: MainToWorkerMessage = {
            type: "START_EXPORT",
            videoBuffer,
            subtitles,
            options,
          };

          worker.postMessage(startMsg, [videoBuffer]);
        } catch (err: unknown) {
          setIsExporting(false);
          const errorMsg = (err as Error).message || "Failed to start export";
          setError(errorMsg);
          reject(err);
        }
      });
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
