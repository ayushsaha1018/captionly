import type { SubtitleLine } from "@captionly/engine";
import {
  DEFAULT_MAX_WORD_GAP_SEC,
  type RawTranscribeWord,
  type SegmentationOptions,
} from "./types";

export interface NormalizedWord {
  text: string;
  start: number; // in seconds
  end: number; // in seconds
}

/**
 * Normalizes raw word objects from Whisper WebGPU, Captions, or custom formats
 * into clean NormalizedWord objects with timestamps in seconds, sorted by start time.
 * Filters out silence markers (e.g. "─", "[silence]") and empty tokens.
 */
export function normalizeWords(rawWords: RawTranscribeWord[]): NormalizedWord[] {
  const result: NormalizedWord[] = [];

  for (const raw of rawWords) {
    // Support text, punctuated_word, word
    const anyRaw = raw as unknown as Record<string, unknown>;
    const rawText =
      (typeof raw.text === "string" ? raw.text : undefined) ||
      (typeof anyRaw.punctuated_word === "string" ? anyRaw.punctuated_word : undefined) ||
      (typeof anyRaw.word === "string" ? anyRaw.word : undefined) ||
      "";

    const text = rawText.trim();
    // Filter out silence markers or empty tokens
    if (!text || text.includes("─") || text.includes("[silence]")) continue;

    let start = 0;
    if (typeof raw.startInSeconds === "number" && !isNaN(raw.startInSeconds)) {
      start = raw.startInSeconds;
    } else if (typeof raw.start === "number" && !isNaN(raw.start)) {
      start = raw.start;
    } else if (typeof raw.startMs === "number" && !isNaN(raw.startMs)) {
      start = raw.startMs / 1000;
    }

    let end = start;
    if (typeof raw.endInSeconds === "number" && !isNaN(raw.endInSeconds)) {
      end = raw.endInSeconds;
    } else if (typeof raw.end === "number" && !isNaN(raw.end)) {
      end = raw.end;
    } else if (typeof raw.endMs === "number" && !isNaN(raw.endMs)) {
      end = raw.endMs / 1000;
    }

    start = Math.max(0, start);
    end = Math.max(start, end);

    result.push({ text, start, end });
  }

  // Sort by start timestamp ascending
  result.sort((a, b) => a.start - b.start || a.end - b.end);

  return result;
}

/**
 * Builds subtitle line chunks based on natural speech boundaries:
 * - pause > MAX_PAUSE_BETWEEN_WORDS (default 0.25s)
 * - chunk.length >= MAX_WORDS_PER_CHUNK (TikTok: 3, Long-form: 8)
 * - chunkDuration > MAX_CHUNK_DURATION (TikTok: 1.8s, Long-form: 4.5s)
 */
export function chunkWordsIntoSubtitleLines(
  words: NormalizedWord[],
  options?: SegmentationOptions,
): SubtitleLine[] {
  // Filter out silence markers
  const filteredWords = words.filter(
    (w) => w.text && !w.text.includes("─") && w.text.trim() !== "",
  );

  if (!filteredWords.length) {
    return [];
  }

  const pacing = options?.pacing ?? "reel";
  const isTikTok = pacing === "reel";

  const MAX_PAUSE_BETWEEN_WORDS = options?.maxSilenceGapSec ?? DEFAULT_MAX_WORD_GAP_SEC;
  const MAX_WORDS_PER_CHUNK = isTikTok ? 3 : 10;
  const MAX_CHUNK_DURATION = isTikTok ? 1.8 : 6;

  // Build chunks based on natural speech boundaries
  const chunks: NormalizedWord[][] = [];
  let currentChunk: NormalizedWord[] = [];

  for (const word of filteredWords) {
    if (!currentChunk.length) {
      currentChunk.push(word);
      continue;
    }

    const prevWord = currentChunk[currentChunk.length - 1];
    const pause = word.start - prevWord.end;
    const chunkDuration = word.end - currentChunk[0].start;

    const shouldSplit =
      pause > MAX_PAUSE_BETWEEN_WORDS ||
      currentChunk.length >= MAX_WORDS_PER_CHUNK ||
      chunkDuration > MAX_CHUNK_DURATION;

    if (shouldSplit) {
      chunks.push(currentChunk);
      currentChunk = [word];
    } else {
      currentChunk.push(word);
    }
  }

  if (currentChunk.length) {
    chunks.push(currentChunk);
  }

  // Format chunks into Captionly SubtitleLines
  const lines: SubtitleLine[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const wordChunk = chunks[i];
    const nextChunk = chunks[i + 1];

    const start = wordChunk[0].start;
    let end = wordChunk[wordChunk.length - 1].end;

    // Micro-gap smoothing: if the next chunk follows within < 0.15s (continuous speech),
    // bridge the micro-gap to prevent 1-frame visual flicker.
    // Pauses (gap >= 0.15s / > MAX_PAUSE_BETWEEN_WORDS) remain completely blank on screen!
    if (nextChunk) {
      const gapToNext = nextChunk[0].start - end;
      if (gapToNext >= 0 && gapToNext < 0.15) {
        end = nextChunk[0].start;
      }
    }

    lines.push({
      id: crypto.randomUUID(),
      start,
      end,
      words: wordChunk.map((w) => ({
        id: crypto.randomUUID(),
        text: w.text,
        start: w.start,
        end: w.end,
      })),
    });
  }

  return lines;
}

/**
 * End-to-end segmentation pipeline:
 * 1. Normalizes raw words from Whisper, Captions, or custom objects
 * 2. Filters silence markers
 * 3. Chunks words by natural speech boundaries & pacing
 */
export function segmentWordsToSubtitleLines(
  rawWords: RawTranscribeWord[],
  options?: SegmentationOptions,
): SubtitleLine[] {
  const normalized = normalizeWords(rawWords);
  return chunkWordsIntoSubtitleLines(normalized, options);
}
