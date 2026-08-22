import { useState, useRef, useCallback } from "react";
import { downloadBlob } from "./downloadBlob";
import type { SubtitleExportData } from "./types";

export type ServerExportPhase = "uploading" | "rendering" | "complete";

export interface UseServerVideoExportReturn {
  isExporting: boolean;
  phase: ServerExportPhase | null;
  error: string | null;
  exportVideo: (
    videoSource: File | Blob | string,
    subtitles: SubtitleExportData,
  ) => Promise<Blob | null>;
  cancelExport: () => void;
  downloadBlob: (blob: Blob, filename?: string) => void;
}

const RENDER_SERVER_URL = import.meta.env.VITE_RENDER_SERVER_URL ?? "http://localhost:4000";

export function useServerVideoExport(): UseServerVideoExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [phase, setPhase] = useState<ServerExportPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancelExport = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsExporting(false);
    setPhase(null);
    setError(null);
  }, []);

  const exportVideo = useCallback(
    async (
      videoSource: File | Blob | string,
      subtitles: SubtitleExportData,
    ): Promise<Blob | null> => {
      setIsExporting(true);
      setError(null);
      setPhase("uploading");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        let videoBlob: Blob;
        if (typeof videoSource === "string") {
          const res = await fetch(videoSource, { signal: controller.signal });
          if (!res.ok) throw new Error(`Failed to load video from URL: ${res.statusText}`);
          videoBlob = await res.blob();
        } else {
          videoBlob = videoSource;
        }

        const form = new FormData();
        form.append("video", videoBlob, "input.mp4");
        form.append("subtitles", JSON.stringify(subtitles));

        setPhase("rendering");
        const res = await fetch(`${RENDER_SERVER_URL}/render`, {
          method: "POST",
          body: form,
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Render server responded with ${res.status}`);
        }

        const blob = await res.blob();
        setPhase("complete");
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
    error,
    exportVideo,
    cancelExport,
    downloadBlob,
  };
}
