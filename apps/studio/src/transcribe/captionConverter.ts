import type { TikTokPage } from "@remotion/captions";
import type { SubtitleLine, Word } from "@captionly/engine";

/**
 * Converts Remotion TikTokPage objects (segmented caption pages)
 * into Captionly's SubtitleLine and Word structures with timestamps in seconds.
 */
export function mapTikTokPagesToSubtitleLines(pages: TikTokPage[]): SubtitleLine[] {
  const lines: SubtitleLine[] = [];

  for (const page of pages) {
    const words: Word[] = [];

    for (const token of page.tokens) {
      const trimmed = token.text.trim();
      if (!trimmed) continue;

      const wordStart = token.fromMs / 1000;
      const wordEnd = Math.max(wordStart, token.toMs / 1000);

      words.push({
        id: crypto.randomUUID(),
        text: trimmed,
        start: wordStart,
        end: wordEnd,
      });
    }

    if (words.length === 0) continue;

    const start = page.startMs / 1000;
    const end = Math.max(start, (page.startMs + page.durationMs) / 1000);

    lines.push({
      id: crypto.randomUUID(),
      start,
      end,
      words,
    });
  }

  return lines;
}
