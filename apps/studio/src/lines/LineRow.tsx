import { memo, useEffect, useRef, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import type { SubtitleLine } from "@captionly/engine";
import { Merge, Plus, Trash2 } from "lucide-react";
import { useStudioStore } from "@/store";
import { formatTimecode } from "@/lib/timecode";
import { DEFAULT_LINE_DURATION } from "@/lib/constants";
import { RulerGutter } from "./RulerGutter";
import { Playhead } from "./Playhead";
import { TimecodeField } from "./TimecodeField";

interface LineRowProps {
  line: SubtitleLine;
  isFirst?: boolean;
  selected: boolean;
  active: boolean;
  nextBoundary: number;
  nextLineId?: string | null;
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
  isFirst,
  selected,
  active,
  nextBoundary,
  nextLineId,
  onSelect,
  playerRef,
}: LineRowProps) {
  const editingLineId = useStudioStore((s) => s.editingLineId);
  const editing = editingLineId === line.id;

  const editLineText = useStudioStore((s) => s.editLineText);
  const endEdit = useStudioStore((s) => s.endEdit);
  const splitLine = useStudioStore((s) => s.splitLine);
  const addLine = useStudioStore((s) => s.addLine);
  const mergeLines = useStudioStore((s) => s.mergeLines);
  const setLineIn = useStudioStore((s) => s.setLineIn);
  const setLineOut = useStudioStore((s) => s.setLineOut);
  const deleteLine = useStudioStore((s) => s.deleteLine);
  const select = useStudioStore((s) => s.select);

  const [draft, setDraft] = useState(() => line.words.map((w) => w.text).join(" "));
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Focus on entry only. Deliberately NOT tied to the resync below, so an
  // external store change (or every keystroke) can't steal focus back.
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing, line.id]);

  // Resync the draft when the STORE's text for this line diverges from what we
  // typed. Splits/merges/undo can rewrite this same id's words while it is
  // still the editing line; without this the next keystroke would commit stale
  // text over them. Comparing against the normalized draft means an echo of our
  // own typing (incl. a trailing space mid-word) is not treated as external.
  useEffect(() => {
    if (!editing) return;
    const storeText = line.words.map((w) => w.text).join(" ");
    if (storeText !== draft.trim().replace(/\s+/g, " ")) setDraft(storeText);
  }, [editing, line.words, draft]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      endEdit();
      const nextGapSec = nextBoundary - line.end;
      if (nextGapSec > 0.001) {
        const endAt = Math.min(line.end + DEFAULT_LINE_DURATION, line.end + nextGapSec);
        addLine(line.id, line.end, endAt);
      }
    }
  };

  const handleAddLine = () => {
    const nextGapSec = nextBoundary - line.end;
    if (nextGapSec > 0.05) {
      const endAt = Math.min(line.end + DEFAULT_LINE_DURATION, nextBoundary);
      addLine(line.id, line.end, endAt);
    } else {
      const dur = line.end - line.start;
      if (dur >= 1.0) {
        const splitPoint =
          Math.round(
            (line.start + Math.max(0.5, dur - Math.min(DEFAULT_LINE_DURATION, dur / 2))) * 100,
          ) / 100;
        setLineOut(line.id, splitPoint);
        addLine(line.id, splitPoint, line.end);
      }
    }
  };

  const handleAddLineBefore = () => {
    const endAt = Math.min(DEFAULT_LINE_DURATION, line.start);
    addLine(null, 0, endAt);
  };

  const canMerge = Boolean(nextLineId);
  const canAddLine = nextBoundary - line.end > 0.05 || line.end - line.start >= 1.0;

  return (
    <div className="flex gap-4">
      <RulerGutter selected={selected} />
      <div
        onClick={() => {
          if (!selected) select(line.id);
        }}
        className={`group relative flex w-full flex-col gap-1.5 rounded-md px-3 py-2.5 transition-colors ${
          selected ? "z-10 bg-raised" : "hover:z-10 hover:bg-raised/50"
        }`}
      >
        {/* Top-center floating pill: appears on hover of first line if there's an empty gap before it */}
        {isFirst && line.start > 0.05 && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              handleAddLineBefore();
            }}
            aria-label="Add line before"
            title="Add line before first subtitle"
            className="pointer-events-none absolute -top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-hairline bg-surface/95 px-2.5 py-0.5 text-[0.6875rem] font-medium text-ink opacity-0 shadow-md backdrop-blur-sm transition-opacity duration-150 hover:border-edit/40 hover:text-edit focus-visible:outline-2 focus-visible:outline-edit group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100"
          >
            <Plus className="h-3 w-3 text-edit" />
            <span>Add line</span>
          </button>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {selected ? (
              <TimecodeField
                value={line.start}
                onCommit={(v) => setLineIn(line.id, v)}
                label="Line in"
              />
            ) : (
              <span
                className={`tabular text-xs ${active ? "text-now font-medium" : "text-ink-muted"}`}
              >
                {formatTimecode(line.start)}
              </span>
            )}
            <span className="text-[10px] text-ink-muted/50">→</span>
            {selected ? (
              <TimecodeField
                value={line.end}
                onCommit={(v) => setLineOut(line.id, v)}
                label="Line out"
              />
            ) : (
              <span className="tabular text-xs text-ink-muted">{formatTimecode(line.end)}</span>
            )}
          </div>

          <div
            className={`flex items-center transition-opacity duration-150 ${
              selected
                ? "pointer-events-auto opacity-100"
                : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100"
            }`}
          >
            <button
              type="button"
              aria-label="Delete line"
              title="Delete line"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                deleteLine(line.id);
              }}
              className="rounded p-1 text-ink-muted transition-colors hover:bg-destructive/20 hover:text-destructive
                         focus-visible:outline-2 focus-visible:outline-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Bottom-center floating pill: appears on block hover for merge and add line */}
        {(canMerge || canAddLine) && (
          <div className="pointer-events-none absolute -bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-hairline bg-surface/95 px-2 py-0.5 opacity-0 shadow-md backdrop-blur-sm transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
            {canMerge && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  mergeLines(line.id, nextLineId!);
                }}
                aria-label="Merge lines"
                title="Merge with next line"
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6875rem] font-medium text-ink transition-colors hover:bg-white/5 hover:text-edit focus-visible:outline-2 focus-visible:outline-edit"
              >
                <Merge className="h-3 w-3 text-edit" />
                <span>Merge</span>
              </button>
            )}
            {canMerge && canAddLine && <div className="h-3 w-px bg-hairline" />}
            {canAddLine && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddLine();
                }}
                aria-label="Add line"
                title="Add line"
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6875rem] font-medium text-ink transition-colors hover:bg-white/5 hover:text-edit focus-visible:outline-2 focus-visible:outline-edit"
              >
                <Plus className="h-3 w-3 text-edit" />
                <span>Add line</span>
              </button>
            )}
          </div>
        )}

        {editing ? (
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            aria-label={`Line ${formatTimecode(line.start)} to ${formatTimecode(line.end)}`}
            onChange={(e) => {
              setDraft(e.target.value);
              editLineText(line.id, e.target.value);
            }}
            onKeyDown={handleKeyDown}
            // Clicking away must clear editingLineId (keyboard-delete and
            // playhead-follow both gate on it). Read live state: Enter's
            // endEdit -> addLine -> beginEdit(newId) cascade unmounts this
            // input, whose blur would otherwise clear the NEW line's id.
            onBlur={() => {
              if (useStudioStore.getState().editingLineId === line.id) endEdit();
            }}
            placeholder="Type the line…"
            className="w-full resize-none overflow-hidden bg-transparent text-base leading-snug text-ink outline-none placeholder:text-ink-muted [field-sizing:content]"
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

        {active && <Playhead playerRef={playerRef} line={line} />}
      </div>
    </div>
  );
});
