export type WhisperModelOption = "base.en" | "tiny.en" | "small.en";

export type PacingOption = "reel" | "standard";

export const PACING_CONFIG: Record<
  PacingOption,
  { label: string; description: string; combineTokensWithinMilliseconds: number }
> = {
  reel: {
    label: "Short phrases (Reels / TikTok)",
    description: "Snappy 1-2 second cues, ideal for short-form social videos",
    combineTokensWithinMilliseconds: 1400,
  },
  standard: {
    label: "Standard lines (YouTube / Long-form)",
    description: "Longer 3-4 second lines, ideal for landscape videos & tutorials",
    combineTokensWithinMilliseconds: 3500,
  },
};

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
