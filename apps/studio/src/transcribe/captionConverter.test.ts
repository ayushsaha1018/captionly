import { describe, it, expect } from "bun:test";
import {
  normalizeWords,
  chunkWordsIntoSubtitleLines,
  segmentWordsToSubtitleLines,
} from "./captionConverter";
import type { RawTranscribeWord } from "./types";

describe("chunkWordsIntoSubtitleLines (TikTok vs Long-form)", () => {
  const continuousSentence = [
    { text: "Welcome", start: 1.0, end: 1.4 },
    { text: "to", start: 1.45, end: 1.6 },
    { text: "our", start: 1.65, end: 1.8 },
    { text: "channel", start: 1.85, end: 2.3 },
    { text: "today", start: 2.35, end: 2.7 },
    { text: "we", start: 2.75, end: 2.9 },
    { text: "are", start: 2.95, end: 3.1 },
    { text: "coding", start: 3.15, end: 3.6 },
  ];

  it("splits into snappy 2-3 word lines in TikTok ('reel') mode", () => {
    const lines = chunkWordsIntoSubtitleLines(continuousSentence, { pacing: "reel" });

    // 8 words should be split into ~3 lines of 2-3 words, avoiding 1-word orphans
    expect(lines.length).toBeGreaterThanOrEqual(3);
    for (const line of lines) {
      expect(line.words.length).toBeGreaterThanOrEqual(2);
      expect(line.words.length).toBeLessThanOrEqual(4);
    }
    // Entire text is preserved
    const allWords = lines.flatMap((l) => l.words.map((w) => w.text));
    expect(allWords).toEqual(continuousSentence.map((w) => w.text));
  });

  it("keeps full lines (up to 8 words) in Long-form ('standard') mode", () => {
    const lines = chunkWordsIntoSubtitleLines(continuousSentence, { pacing: "standard" });

    // 8 words fit comfortably in 1 standard line (duration 2.6s, max words 8)
    expect(lines).toHaveLength(1);
    expect(lines[0].words).toHaveLength(8);
    expect(lines[0].start).toBe(1.0);
    expect(lines[0].end).toBe(3.6);
  });

  it("seamlessly connects consecutive lines within the same sentence (no 1-frame blink)", () => {
    const lines = chunkWordsIntoSubtitleLines(continuousSentence, { pacing: "reel" });

    for (let i = 0; i < lines.length - 1; i++) {
      // Line i end equals Line i+1 start within continuous speech
      expect(lines[i].end).toBeCloseTo(lines[i + 1].start, 2);
    }

    // The final line ends at the last word's end timestamp
    expect(lines[lines.length - 1].end).toBe(3.6);
  });
});

describe("segmentWordsToSubtitleLines (End-to-End Bug Fix Verification)", () => {
  it("prevents words before a silence from lingering across 4-5 seconds", () => {
    const rawWords: RawTranscribeWord[] = [
      { text: "Hello", startInSeconds: 1.0, endInSeconds: 1.4 },
      { text: "world", startInSeconds: 1.5, endInSeconds: 1.8 },
      // 4.2 seconds of silence
      { text: "Next", startInSeconds: 6.0, endInSeconds: 6.3 },
      { text: "sentence", startInSeconds: 6.4, endInSeconds: 6.9 },
    ];

    const lines = segmentWordsToSubtitleLines(rawWords, { pacing: "reel" });

    expect(lines).toHaveLength(2);

    // Line 1 should end when speech ends (~1.8s), NOT stretch to 6.0s!
    expect(lines[0].start).toBe(1.0);
    expect(lines[0].end).toBe(1.8);
    expect(lines[0].words.map((w) => w.text)).toEqual(["Hello", "world"]);

    // Line 2 starts at 6.0s
    expect(lines[1].start).toBe(6.0);
    expect(lines[1].end).toBe(6.9);
    expect(lines[1].words.map((w) => w.text)).toEqual(["Next", "sentence"]);

    // There is a 4.2 second blank gap between line 1 and line 2
    const blankGap = lines[1].start - lines[0].end;
    expect(blankGap).toBeCloseTo(4.2, 1);
  });

  it("handles two words with a huge pause between them as separate single-word lines", () => {
    const rawWords: RawTranscribeWord[] = [
      { text: "One", start: 1.0, end: 1.3 },
      // 5.0 seconds silence
      { text: "Two", start: 6.3, end: 6.6 },
    ];

    const lines = segmentWordsToSubtitleLines(rawWords, { pacing: "reel" });

    expect(lines).toHaveLength(2);
    expect(lines[0].start).toBe(1.0);
    expect(lines[0].end).toBe(1.3);
    expect(lines[1].start).toBe(6.3);
    expect(lines[1].end).toBe(6.6);
  });

  it("handles empty words or whitespace-only words gracefully", () => {
    expect(segmentWordsToSubtitleLines([])).toEqual([]);
    expect(segmentWordsToSubtitleLines([{ text: "   ", start: 0, end: 1 }])).toEqual([]);
  });

  it("filters out silence markers (─ or [silence])", () => {
    const rawWords: RawTranscribeWord[] = [
      { text: "Hello", start: 1.0, end: 1.3 },
      { text: "───", start: 1.4, end: 2.0 },
      { text: "world", start: 2.2, end: 2.5 },
    ];
    const lines = segmentWordsToSubtitleLines(rawWords, { pacing: "reel" });
    const allWords = lines.flatMap((l) => l.words.map((w) => w.text));
    expect(allWords).toEqual(["Hello", "world"]);
  });

  it("normalizes different timestamp formats (startInSeconds, start, startMs)", () => {
    const raw: RawTranscribeWord[] = [
      { text: "FromSec", startInSeconds: 1.2, endInSeconds: 1.8 },
      { text: "FromStart", start: 2.0, end: 2.5 },
      { text: "FromMs", startMs: 3000, endMs: 3500 },
    ];

    const normalized = normalizeWords(raw);
    expect(normalized).toEqual([
      { text: "FromSec", start: 1.2, end: 1.8 },
      { text: "FromStart", start: 2.0, end: 2.5 },
      { text: "FromMs", start: 3.0, end: 3.5 },
    ]);
  });
});
