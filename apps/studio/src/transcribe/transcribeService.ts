import {
  canUseWhisperWebGpu,
  resampleTo16Khz,
  loadWhisperModel,
  transcribe,
  toCaptions,
  isWhisperModelCached,
} from "@remotion/whisper-webgpu";
import { createTikTokStyleCaptions } from "@remotion/captions";
import { mapTikTokPagesToSubtitleLines } from "./captionConverter";
import {
  PACING_CONFIG,
  type WhisperModelOption,
  type PacingOption,
  type TranscribeProgress,
} from "./types";
import type { SubtitleLine } from "@captionly/engine";

export async function checkWebGpuSupport(): Promise<{ supported: boolean; reason?: string }> {
  try {
    const res = await canUseWhisperWebGpu();
    return {
      supported: res.supported,
      reason: res.detailedReason || res.reason,
    };
  } catch (err) {
    return {
      supported: false,
      reason: err instanceof Error ? err.message : "WebGPU check failed",
    };
  }
}

export async function checkModelCached(model: WhisperModelOption): Promise<boolean> {
  try {
    return await isWhisperModelCached(model);
  } catch {
    return false;
  }
}

export interface TranscribePipelineOptions {
  file: File;
  model: WhisperModelOption;
  pacing: PacingOption;
  onProgress?: (progress: TranscribeProgress) => void;
}

/**
 * Runs the complete in-browser Whisper transcription pipeline:
 * 1. Verifies WebGPU support
 * 2. Resamples audio track to 16kHz mono Float32Array
 * 3. Downloads / loads the requested Whisper ONNX model
 * 4. Performs WebGPU inference
 * 5. Converts tokens to Captions & segments into TikTok/standard lines
 */
export async function runTranscriptionPipeline(
  options: TranscribePipelineOptions,
): Promise<SubtitleLine[]> {
  const { file, model, pacing, onProgress } = options;

  // 1. Check WebGPU
  const support = await checkWebGpuSupport();
  if (!support.supported) {
    throw new Error(support.reason || "WebGPU is not supported in this browser.");
  }

  // 2. Resample Audio to 16kHz mono Float32Array via Web Audio API
  onProgress?.({ stage: "extracting-audio", audioProgress: 0 });
  const channelWaveform = await resampleTo16Khz({
    file,
    onProgress: (p) => onProgress?.({ stage: "extracting-audio", audioProgress: p }),
  });

  // 3. Download / Load Whisper Model
  onProgress?.({ stage: "downloading-model", modelProgress: 0 });
  await loadWhisperModel({
    model,
    onProgress: ({ progress }) =>
      onProgress?.({ stage: "downloading-model", modelProgress: progress }),
  });

  // 4. Transcribe with WebGPU
  onProgress?.({ stage: "transcribing" });
  const transcription = await transcribe({
    channelWaveform,
    model,
  });

  // 5. Convert to Captions
  const { captions } = toCaptions({ whisperWebGpuOutput: transcription });

  if (!captions || captions.length === 0) {
    onProgress?.({ stage: "done" });
    return [];
  }

  // 6. Segment into TikTok style pages based on chosen pacing
  const { combineTokensWithinMilliseconds } = PACING_CONFIG[pacing];
  const { pages } = createTikTokStyleCaptions({
    captions,
    combineTokensWithinMilliseconds,
  });

  // 7. Map to SubtitleLine[]
  const lines = mapTikTokPagesToSubtitleLines(pages);

  onProgress?.({ stage: "done" });
  return lines;
}
