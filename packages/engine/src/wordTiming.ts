import type { Word } from "./types";

const MIN_WORD_DURATION = 0.2; // seconds
const PUNCTUATION_BONUS = 3; // extra weight for a trailing .,!?

function weightOf(word: string): number {
  const punctuationBonus = /[.,!?]$/.test(word) ? PUNCTUATION_BONUS : 0;
  return word.length + punctuationBonus;
}

/**
 * The single source of word timings (roadmap §2). Character-weighted
 * distribution with a punctuation pause bonus and a per-word minimum,
 * normalized to fill [start, end] exactly. See spec §2 for the algorithm
 * description this implements.
 */
export function computeWordTimings(text: string, start: number, end: number): Word[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const total = end - start;
  const weights = tokens.map(weightOf);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  let durations = weights.map((w) => (w / weightSum) * total);

  const minFits = tokens.length * MIN_WORD_DURATION <= total;
  if (minFits) {
    const belowFloor = durations.map((d) => d < MIN_WORD_DURATION);
    const flooredTotal = belowFloor.filter(Boolean).length * MIN_WORD_DURATION;
    const aboveIndices = belowFloor
      .map((isBelow, i) => (isBelow ? -1 : i))
      .filter((i) => i !== -1);
    const aboveWeightSum = aboveIndices.reduce((sum, i) => sum + weights[i], 0);
    const remaining = total - flooredTotal;

    durations = durations.map((d, i) => {
      if (belowFloor[i]) return MIN_WORD_DURATION;
      if (aboveWeightSum === 0) return d;
      return (weights[i] / aboveWeightSum) * remaining;
    });
  }

  const words: Word[] = [];
  let cursor = start;
  for (let i = 0; i < tokens.length; i++) {
    const wordEnd = cursor + durations[i];
    words.push({ id: crypto.randomUUID(), text: tokens[i], start: cursor, end: wordEnd });
    cursor = wordEnd;
  }

  // Force exact boundaries so the range is filled exactly regardless of float drift.
  words[0].start = start;
  words[words.length - 1].end = end;

  return words;
}
