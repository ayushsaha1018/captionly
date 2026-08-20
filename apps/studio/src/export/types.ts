import type {
  SubtitleLine,
  SubtitleStyle,
  SubtitlePosition,
  AnimationConfig,
} from "@captionly/engine";

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
