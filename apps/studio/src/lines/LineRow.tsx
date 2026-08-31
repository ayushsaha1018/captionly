import { memo } from "react";
import type { PlayerRef } from "@remotion/player";
import type { SubtitleLine } from "@captionly/engine";
import { formatTimecode } from "@/lib/timecode";
import { lineHeight } from "./geometry";
import { RulerGutter } from "./RulerGutter";
import { WordStrip } from "./WordStrip";
import { Playhead } from "./Playhead";

interface LineRowProps {
  line: SubtitleLine;
  selected: boolean;
  active: boolean;
  onSelect: (id: string) => void;
  playerRef: React.RefObject<PlayerRef | null>;
}

/**
 * memo is load-bearing. The list container re-renders on any document change;
 * rows only re-render when their own line object identity changes. Store
 * updates MUST preserve references for untouched lines.
 */
export const LineRow = memo(function LineRow({
  line,
  selected,
  active,
  onSelect,
  playerRef,
}: LineRowProps) {
  return (
    <div className="flex gap-4">
      <RulerGutter selected={selected} />
      <div
        role="button"
        tabIndex={0}
        aria-label={`Line ${formatTimecode(line.start)} to ${formatTimecode(line.end)}`}
        onClick={() => onSelect(line.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(line.id);
          }
        }}
        style={{ minHeight: lineHeight(line.end - line.start) }}
        className={`group relative flex w-full flex-col gap-2 rounded-md px-3 py-3 text-left
                    transition-colors focus-visible:outline-2 focus-visible:outline-offset-2
                    focus-visible:outline-edit ${
                      selected ? "bg-raised" : "hover:bg-raised/50"
                    }`}
      >
        <div className="flex items-baseline justify-between">
          <span
            className={`tabular text-xs ${active ? "text-now" : "text-ink-muted"}`}
          >
            {formatTimecode(line.start)}
          </span>
          <span className="tabular text-xs text-ink-muted">
            {formatTimecode(line.end)}
          </span>
        </div>

        <p className={`text-base leading-snug ${active ? "text-now" : "text-ink"}`}>
          {line.words.map((w) => w.text).join(" ")}
        </p>

        {selected && <WordStrip line={line} />}
        {active && <Playhead playerRef={playerRef} line={line} />}
      </div>
    </div>
  );
});
