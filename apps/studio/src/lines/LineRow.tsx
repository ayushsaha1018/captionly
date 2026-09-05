import { memo, useEffect, useRef, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import type { SubtitleLine } from "@captionly/engine";
import { Trash2 } from "lucide-react";
import { useStudioStore } from "@/store";
import { formatTimecode } from "@/lib/timecode";
import { DEFAULT_LINE_DURATION } from "@/lib/constants";
import { lineHeight } from "./geometry";
import { RulerGutter } from "./RulerGutter";
import { WordStrip } from "./WordStrip";
import { Playhead } from "./Playhead";
import { TimecodeField } from "./TimecodeField";

interface LineRowProps {
  line: SubtitleLine;
  selected: boolean;
  active: boolean;
  nextBoundary: number;
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
  nextBoundary,
  onSelect,
  playerRef,
}: LineRowProps) {
  const editingLineId = useStudioStore((s) => s.editingLineId);
  const editing = editingLineId === line.id;

  const editLineText = useStudioStore((s) => s.editLineText);
  const endEdit = useStudioStore((s) => s.endEdit);
  const splitLine = useStudioStore((s) => s.splitLine);
  const addLine = useStudioStore((s) => s.addLine);
  const setLineIn = useStudioStore((s) => s.setLineIn);
  const setLineOut = useStudioStore((s) => s.setLineOut);
  const deleteLine = useStudioStore((s) => s.deleteLine);

  const [draft, setDraft] = useState(() => line.words.map((w) => w.text).join(" "));
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset the draft to the store's text whenever editing (re)starts, so
  // reopening a line after an undo (or a different line) doesn't show stale
  // text, and focus it (roadmap: one click selects, seeks, AND focuses text).
  useEffect(() => {
    if (editing) {
      setDraft(line.words.map((w) => w.text).join(" "));
      inputRef.current?.focus();
    }
    // Intentionally omit `line` from deps - only re-sync on an edit-mode transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, line.id]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      endEdit();
      return;
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      splitLine(line.id, e.currentTarget.selectionStart ?? 0);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      endEdit();
      const nextGapSec = nextBoundary - line.end;
      if (nextGapSec > 0.001) {
        const endAt = Math.min(line.end + DEFAULT_LINE_DURATION, line.end + nextGapSec);
        addLine(line.id, line.end, endAt);
      }
    }
  };

  return (
    <div className="flex gap-4">
      <RulerGutter selected={selected} />
      <div
        style={{ minHeight: lineHeight(line.end - line.start) }}
        className={`group relative flex w-full flex-col gap-2 rounded-md px-3 py-3
                    transition-colors ${selected ? "bg-raised" : "hover:bg-raised/50"}`}
      >
        <div className="flex items-baseline justify-between gap-2">
          {selected ? (
            <TimecodeField
              value={line.start}
              onCommit={(v) => setLineIn(line.id, v)}
              label="Line in"
            />
          ) : (
            <span className={`tabular text-xs ${active ? "text-now" : "text-ink-muted"}`}>
              {formatTimecode(line.start)}
            </span>
          )}
          {selected ? (
            <TimecodeField
              value={line.end}
              onCommit={(v) => setLineOut(line.id, v)}
              label="Line out"
            />
          ) : (
            <span className="tabular text-xs text-ink-muted">{formatTimecode(line.end)}</span>
          )}
          {selected && (
            <button
              type="button"
              aria-label="Delete line"
              onClick={() => deleteLine(line.id)}
              className="text-ink-muted opacity-0 transition-opacity hover:text-edit
                         group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            aria-label={`Line ${formatTimecode(line.start)} to ${formatTimecode(line.end)}`}
            onChange={(e) => {
              setDraft(e.target.value);
              editLineText(line.id, e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type the line…"
            className="w-full bg-transparent text-base leading-snug text-ink outline-none
                       placeholder:text-ink-muted"
          />
        ) : (
          <p
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
            className={`cursor-text text-base leading-snug focus-visible:outline-2
                        focus-visible:outline-offset-2 focus-visible:outline-edit
                        ${active ? "text-now" : "text-ink"}`}
          >
            {line.words.length > 0 ? (
              line.words.map((w) => w.text).join(" ")
            ) : (
              <span className="text-ink-muted">Click to type…</span>
            )}
          </p>
        )}

        {selected && <WordStrip line={line} />}
        {active && <Playhead playerRef={playerRef} line={line} />}
      </div>
    </div>
  );
});
