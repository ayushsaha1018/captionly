import { useState, useRef, useCallback, useEffect } from "react";
import { downloadBlob } from "./downloadBlob";
import type { SubtitleExportData, ExportProgress } from "./types";

export type ServerExportPhase = "uploading" | "queued" | "rendering" | "complete";

export interface UseServerVideoExportReturn {
  isExporting: boolean;
  phase: ServerExportPhase | null;
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

const RENDER_SERVER_URL = import.meta.env.VITE_RENDER_SERVER_URL ?? "http://localhost:4000";
const POLL_INTERVAL_MS = 1000;

type JobStatusResponse = {
  status: "queued" | "processing" | "complete" | "error";
  progress: number;
  renderedFrames: number;
  totalFrames: number;
  error: string | null;
};

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export function useServerVideoExport(): UseServerVideoExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [phase, setPhase] = useState<ServerExportPhase | null>(null);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancelExport = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsExporting(false);
    setPhase(null);
    setProgress(null);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const exportVideo = useCallback(
    async (
      videoSource: File | Blob | string,
      subtitles: SubtitleExportData,
      durationSec: number,
      width: number,
      height: number,
    ): Promise<Blob | null> => {
      setIsExporting(true);
      setError(null);
      setProgress(null);
      setPhase("uploading");

      const controller = new AbortController();
      abortRef.current = controller;
      const startTime = performance.now();

      try {
        const form = new FormData();
        if (videoSource instanceof File) {
          form.append("video", videoSource, videoSource.name);
        } else if (typeof videoSource === "string") {
          const res = await fetch(videoSource, { signal: controller.signal });
          if (!res.ok) throw new Error(`Failed to load video from URL: ${res.statusText}`);
          const videoBlob = await res.blob();
          form.append("video", videoBlob, "input.mp4");
        } else {
          form.append("video", videoSource, "input.mp4");
        }
        form.append("subtitles", JSON.stringify(subtitles));
        form.append("width", String(width));
        form.append("height", String(height));
        form.append("durationSec", String(durationSec));
        form.append("fps", "30");

        const submitRes = await fetch(`${RENDER_SERVER_URL}/render`, {
          method: "POST",
          body: form,
          signal: controller.signal,
        });
        if (!submitRes.ok) {
          const body = await submitRes.json().catch(() => null);
          throw new Error(body?.error || `Render server responded with ${submitRes.status}`);
        }
        const { jobId } = (await submitRes.json()) as { jobId: string };

        setPhase("queued");
        let status: JobStatusResponse;
        do {
          await sleep(POLL_INTERVAL_MS, controller.signal);
          const statusRes = await fetch(`${RENDER_SERVER_URL}/render/${jobId}`, {
            signal: controller.signal,
          });
          if (!statusRes.ok) throw new Error(`Lost track of render job (${statusRes.status})`);
          status = await statusRes.json();

          if (status.status === "error") throw new Error(status.error || "Server render failed");

          if (status.status === "processing") {
            setPhase("rendering");
            const elapsedSec = (performance.now() - startTime) / 1000;
            setProgress({
              phase: "rendering",
              progress: status.progress,
              currentFrame: status.renderedFrames,
              totalFrames: status.totalFrames,
              fps: elapsedSec > 0 ? Math.round(status.renderedFrames / elapsedSec) : 0,
              estimatedRemainingSec:
                status.progress > 0 && elapsedSec > 0
                  ? Math.max(0, Math.round(elapsedSec / status.progress - elapsedSec))
                  : 0,
            });
          }
        } while (status.status === "queued" || status.status === "processing");

        const outputRes = await fetch(`${RENDER_SERVER_URL}/render/${jobId}/output`, {
          signal: controller.signal,
        });
        if (!outputRes.ok) throw new Error(`Failed to fetch rendered video (${outputRes.status})`);
        const blob = await outputRes.blob();

        setPhase("complete");
        setProgress((prev) => (prev ? { ...prev, phase: "complete", progress: 1 } : prev));
        setIsExporting(false);
        return blob;
      } catch (err: unknown) {
        setIsExporting(false);
        if ((err as Error).name === "AbortError") {
          return null;
        }
        const message = (err as Error).message || "Server export failed";
        setError(message);
        throw err;
      } finally {
        abortRef.current = null;
      }
    },
    [],
  );

  return {
    isExporting,
    phase,
    progress,
    error,
    exportVideo,
    cancelExport,
    downloadBlob,
  };
}
