import { describe, it, expect } from "bun:test";
import { mapTikTokPagesToSubtitleLines } from "./captionConverter";
import type { TikTokPage } from "@remotion/captions";

describe("mapTikTokPagesToSubtitleLines", () => {
  it("converts TikTokPage[] to SubtitleLine[] with seconds timestamps", () => {
    const pages: TikTokPage[] = [
      {
        text: "Hello world",
        startMs: 500,
        durationMs: 1500,
        tokens: [
          { text: "Hello", fromMs: 500, toMs: 1000 },
          { text: " world", fromMs: 1000, toMs: 2000 },
        ],
      },
      {
        text: " welcome here",
        startMs: 2500,
        durationMs: 1200,
        tokens: [
          { text: " welcome", fromMs: 2500, toMs: 3100 },
          { text: " here", fromMs: 3100, toMs: 3700 },
        ],
      },
    ];

    const lines = mapTikTokPagesToSubtitleLines(pages);

    expect(lines).toHaveLength(2);

    expect(lines[0].start).toBe(0.5);
    expect(lines[0].end).toBe(2);
    expect(lines[0].words).toHaveLength(2);
    expect(lines[0].words[0]).toEqual({
      id: expect.any(String),
      text: "Hello",
      start: 0.5,
      end: 1,
    });
    expect(lines[0].words[1]).toEqual({
      id: expect.any(String),
      text: "world",
      start: 1,
      end: 2,
    });

    expect(lines[1].start).toBe(2.5);
    expect(lines[1].end).toBe(3.7);
    expect(lines[1].words).toHaveLength(2);
    expect(lines[1].words[0].text).toBe("welcome");
    expect(lines[1].words[1].text).toBe("here");
  });

  it("handles empty pages array", () => {
    const lines = mapTikTokPagesToSubtitleLines([]);
    expect(lines).toEqual([]);
  });

  it("filters out empty tokens or pages without words", () => {
    const pages: TikTokPage[] = [
      {
        text: "",
        startMs: 0,
        durationMs: 1000,
        tokens: [],
      },
      {
        text: "   ",
        startMs: 1000,
        durationMs: 500,
        tokens: [{ text: "   ", fromMs: 1000, toMs: 1500 }],
      },
      {
        text: "Valid line",
        startMs: 2000,
        durationMs: 1000,
        tokens: [
          { text: "", fromMs: 2000, toMs: 2100 },
          { text: "Valid", fromMs: 2100, toMs: 2500 },
          { text: " line", fromMs: 2500, toMs: 3000 },
        ],
      },
    ];

    const lines = mapTikTokPagesToSubtitleLines(pages);
    expect(lines).toHaveLength(1);
    expect(lines[0].words).toHaveLength(2);
    expect(lines[0].words[0].text).toBe("Valid");
    expect(lines[0].words[1].text).toBe("line");
  });
});
