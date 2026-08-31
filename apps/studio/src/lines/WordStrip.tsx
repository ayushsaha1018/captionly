import type { SubtitleLine } from "@captionly/engine";

/**
 * Chips sized to each word's share of the line's duration, so computed word
 * timings are inspectable rather than invisible.
 *
 * The stagger is one of the two microinteractions in the design; the global
 * prefers-reduced-motion rule in styles.css collapses it.
 */
export function WordStrip({ line }: { line: SubtitleLine }) {
  const span = line.end - line.start;
  if (span <= 0 || line.words.length === 0) return null;

  return (
    <div className="flex w-full gap-px overflow-hidden rounded-sm" aria-hidden>
      {line.words.map((w, i) => (
        <span
          key={w.id}
          title={`${w.text} · ${(w.end - w.start).toFixed(2)}s`}
          style={{
            flexGrow: Math.max(0.0001, w.end - w.start),
            flexBasis: 0,
            animationDelay: `${i * 18}ms`,
          }}
          className="animate-in fade-in slide-in-from-left-1 truncate bg-raised px-1.5
                     py-1 text-center text-[0.625rem] text-ink-muted duration-200"
        >
          {w.text}
        </span>
      ))}
    </div>
  );
}
