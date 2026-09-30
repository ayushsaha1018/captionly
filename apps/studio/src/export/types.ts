import type {
  SubtitleLine,
  SubtitleStyle,
  SubtitlePosition,
  AnimationConfig,
} from "@captionly/engine";

export interface VideoExportOptions {
  bitrate: number;
  fps?: number;
}

/**
 * Checks whether the browser supports Chromium's experimental native HTML-in-canvas API
 * (CanvasRenderingContext2D.prototype.drawElementImage).
 * When enabled via chrome://flags/#canvas-draw-element, Remotion renders the DOM directly
 * using Chromium's internal compositor with full GPU acceleration and subpixel antialiasing.
 */
export function isHtmlInCanvasSupported(): boolean {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d") as
    (CanvasRenderingContext2D & { drawElementImage?: unknown }) | null;
  return typeof ctx?.drawElementImage === "function";
}

/**
 * Picks the client export bitrate (bits/sec). Burning in captions is always a re-encode, so we
 * aim slightly above the source bitrate. The floor (Remotion's "very-high" preset, 12 Mbps at
 * 1080p H.264) keeps caption edges crisp on low-bitrate sources; the cap stops file bloat.
 * renderMediaOnWeb only exposes variable-bitrate mode, so hardware encoders may overshoot this.
 */
export function calculateVideoBitrate(
  width: number,
  height: number,
  sourceBitrate?: number,
): number {
  const scale = Math.pow((width * height) / (1920 * 1080), 0.95);
  const floor = 12_000_000 * scale;
  const cap = 25_000_000 * scale;
  const target = sourceBitrate ? sourceBitrate * 1.2 : floor;
  return Math.round(Math.min(cap, Math.max(floor, target)));
}

export interface ExportOptions {
  bitrate?: number;
  fps?: number;
  width?: number;
  height?: number;
}

export interface SubtitleExportData {
  lines: SubtitleLine[];
  style: SubtitleStyle;
  position: SubtitlePosition;
  animation: AnimationConfig;
}

export interface ExportProgress {
  phase: "demuxing" | "rendering" | "muxing" | "complete";
  progress: number; // 0.0 - 1.0
  currentFrame: number;
  totalFrames: number;
  fps: number;
  estimatedRemainingSec: number;
}

export type MainToWorkerMessage =
  | {
      type: "START_EXPORT";
      videoBuffer: ArrayBuffer;
      subtitles: SubtitleExportData;
      options?: ExportOptions;
    }
  | {
      type: "CANCEL_EXPORT";
    };

export type WorkerToMainMessage =
  | {
      type: "PROGRESS";
      data: ExportProgress;
    }
  | {
      type: "COMPLETE";
      buffer: ArrayBuffer;
      duration: number;
      fileSize: number;
      mimeType: string;
    }
  | {
      type: "ERROR";
      message: string;
      details?: string;
    };
