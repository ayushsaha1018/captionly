import "./worker-polyfill";
import { runExportPipeline } from "./pipeline";
import type { MainToWorkerMessage, WorkerToMainMessage, ExportProgress } from "./types";

let currentAbortController: AbortController | null = null;

self.onerror = (e) => {
  console.error("Worker unhandled error:", e);
};

self.onmessage = async (e: MessageEvent<MainToWorkerMessage>) => {
  const msg = e.data;

  if (msg.type === "CANCEL_EXPORT") {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
    return;
  }

  if (msg.type === "START_EXPORT") {
    currentAbortController = new AbortController();
    const { signal } = currentAbortController;

    try {
      const result = await runExportPipeline({
        videoBuffer: msg.videoBuffer,
        subtitles: msg.subtitles,
        options: msg.options,
        signal,
        onProgress: (progress: ExportProgress) => {
          const progressMsg: WorkerToMainMessage = {
            type: "PROGRESS",
            data: progress,
          };
          self.postMessage(progressMsg);
        },
      });

      const completeMsg: WorkerToMainMessage = {
        type: "COMPLETE",
        buffer: result.buffer,
        duration: result.duration,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
      };

      // Transfer the buffer for zero-copy memory transfer to main thread
      self.postMessage(completeMsg, [result.buffer]);
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Export pipeline failed:", error);
      const errorMsg: WorkerToMainMessage = {
        type: "ERROR",
        message: error.message || "Unknown error during video export",
        details: error.stack,
      };
      self.postMessage(errorMsg);
    } finally {
      currentAbortController = null;
    }
  }
};
