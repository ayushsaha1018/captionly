import { describe, expect, it } from "bun:test";
import { computeWordTimings } from "./wordTiming";

describe("computeWordTimings", () => {
  it("fills the exact start/end range", () => {
    const words = computeWordTimings("hello there friend", 10, 13);
    expect(words[0].start).toBe(10);
    expect(words.at(-1)!.end).toBe(13);
  });

  it("produces monotonic, contiguous, non-overlapping words", () => {
    const words = computeWordTimings("one two three four", 0, 4);
    for (let i = 1; i < words.length; i++) {
      expect(words[i].start).toBe(words[i - 1].end);
      expect(words[i].end).toBeGreaterThan(words[i].start);
    }
  });

  it("gives a punctuation-terminated word more time than an equal-length word without", () => {
    const words = computeWordTimings("aaa aa.", 0, 10);
    const durationOf = (w: (typeof words)[number]) => w.end - w.start;
    expect(durationOf(words[1])).toBeGreaterThan(durationOf(words[0]));
  });

  it("falls back to proportional split with no negative widths when the minimum is unsatisfiable", () => {
    // 5 words at a 0.2s minimum would need 1.0s; only 0.3s is available.
    const words = computeWordTimings("a bb ccc dddd eeeee", 0, 0.3);
    expect(words).toHaveLength(5);
    for (const w of words) {
      expect(w.end).toBeGreaterThan(w.start);
    }
    expect(words[0].start).toBe(0);
    expect(words.at(-1)!.end).toBe(0.3);
  });

  it("returns an empty array for empty or whitespace-only text", () => {
    expect(computeWordTimings("", 0, 5)).toEqual([]);
    expect(computeWordTimings("   ", 0, 5)).toEqual([]);
  });

  it("assigns each word a unique id", () => {
    const words = computeWordTimings("a a a", 0, 3);
    const ids = new Set(words.map((w) => w.id));
    expect(ids.size).toBe(words.length);
  });
});
