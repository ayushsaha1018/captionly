import type { WhisperWebGpuWord } from "@remotion/whisper-webgpu";

export type WhisperModelOption = "base.en" | "tiny.en" | "small.en";

export type PacingOption = "reel" | "standard";

/** Default maximum pause gap between words to consider them part of the same sentence/utterance */
export const DEFAULT_MAX_WORD_GAP_SEC = 0.25;

export interface PacingSettings {
  label: string;
  description: string;
  maxWordsPerLine: number;
  targetDurationSec: number;
  maxDurationSec: number;
  maxCharsPerLine: number;
}

export const PACING_SETTINGS: Record<PacingOption, PacingSettings> = {
  reel: {
    label: "TikTok / Reels (Short-form)",
    description: "Snappy 2-3 word cues (~1-2s), ideal for vertical short-form videos",
    maxWordsPerLine: 3,
    targetDurationSec: 1.4,
    maxDurationSec: 1.8,
    maxCharsPerLine: 24,
  },
  standard: {
    label: "Long-form / YouTube (Standard)",
    description: "Full sentences and lines (~3-4s), ideal for horizontal & landscape videos",
    maxWordsPerLine: 10,
    targetDurationSec: 3.2,
    maxDurationSec: 6,
    maxCharsPerLine: 42,
  },
};

export const PACING_CONFIG: Record<
  PacingOption,
  { label: string; description: string; combineTokensWithinMilliseconds: number }
> = {
  reel: {
    label: "TikTok / Reels (Short-form)",
    description: "Snappy 2-3 word cues, ideal for vertical short-form videos",
    combineTokensWithinMilliseconds: 1400,
  },
  standard: {
    label: "Long-form / YouTube (Standard)",
    description: "Standard lines & full sentences, ideal for landscape videos & tutorials",
    combineTokensWithinMilliseconds: 3500,
  },
};

export type RawTranscribeWord = WhisperWebGpuWord | { text: string; start: number; end: number };

export interface SegmentationOptions {
  pacing?: PacingOption;
  maxSilenceGapSec?: number;
}

export const MODEL_OPTIONS: {
  id: WhisperModelOption;
  name: string;
  sizeEstimate: string;
  recommended?: boolean;
}[] = [
  {
    id: "base.en",
    name: "Base English",
    sizeEstimate: "~73 MB",
    recommended: true,
  },
  {
    id: "tiny.en",
    name: "Tiny English",
    sizeEstimate: "~39 MB",
  },
  {
    id: "small.en",
    name: "Small English",
    sizeEstimate: "~244 MB",
  },
];

export type TranscribeStage =
  "idle" | "extracting-audio" | "downloading-model" | "transcribing" | "done" | "error";

export interface TranscribeProgress {
  stage: TranscribeStage;
  modelProgress?: number; // 0..1
  audioProgress?: number; // 0..1
  error?: string;
}
