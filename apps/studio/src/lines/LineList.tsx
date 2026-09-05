import type { PlayerRef } from "@remotion/player";
import { useCallback, useEffect, useRef } from "react";
import { Film, Plus } from "lucide-react";
import { useStudioStore } from "@/store";
import { DEFAULT_LINE_DURATION, FPS } from "@/lib/constants";
import { LineRow } from "./LineRow";
import { useActiveLineId } from "./Playhead";

function Rows({
  playerRef,
  onSelect,
}: {
  playerRef: React.RefObject<PlayerRef | null>;
  onSelect: (id: string) => void;
}) {
  const lines = useStudioStore((s) => s.lines);
  const selectedLineId = useStudioStore((s) => s.selectedLineId);
  const editingLineId = useStudioStore((s) => s.editingLineId);
  const select = useStudioStore((s) => s.select);
  const addLine = useStudioStore((s) => s.addLine);
  const durationSec = useStudioStore((s) => s.video?.durationSec ?? 0);
  const activeId = useActiveLineId(playerRef);
  const activeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  // Playback drives selection (two-way sync, spec §8) - but never while a
  // different line is being actively edited, so playback can't steal focus
  // from someone typing. select() is a pure state setter; the seek-on-select
  // behavior stays in LineList's onSelect below, so this never triggers a seek.
  useEffect(() => {
    if (activeId && editingLineId === null) select(activeId);
  }, [activeId, editingLineId, select]);

  if (lines.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-surface/30 p-6 text-center">
        <p className="text-sm font-medium text-ink">No subtitles spotted yet</p>
        <p className="mt-1 max-w-xs text-xs text-ink-muted">
          Add your first subtitle line to get started.
        </p>
        <button
          type="button"
          onClick={() => addLine(null, 0, Math.min(DEFAULT_LINE_DURATION, durationSec))}
          className="mt-4 flex items-center gap-1.5 rounded-md bg-edit px-3 py-1.5 text-xs font-semibold text-void transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Add first line
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {lines.map((line, i) => (
        <div key={line.id} ref={line.id === activeId ? activeRef : undefined} className="relative">
          {i > 0 && <div aria-hidden className="ml-6 h-px bg-hairline" />}
          <LineRow
            line={line}
            isFirst={i === 0}
            selected={line.id === selectedLineId}
            active={line.id === activeId}
            nextBoundary={lines[i + 1]?.start ?? durationSec}
            nextLineId={lines[i + 1]?.id ?? null}
            onSelect={onSelect}
            playerRef={playerRef}
          />
        </div>
      ))}
    </div>
  );
}

export function LineList({ playerRef }: { playerRef: React.RefObject<PlayerRef | null> }) {
  const video = useStudioStore((s) => s.video);
  const beginEdit = useStudioStore((s) => s.beginEdit);

  // One click selects, seeks, AND begins editing - spec §5 "one click does everything".
  const onSelect = useCallback(
    (id: string) => {
      beginEdit(id);
      const line = useStudioStore.getState().lines.find((l) => l.id === id);
      if (line) playerRef.current?.seekTo(Math.round(line.start * FPS));
    },
    [beginEdit, playerRef],
  );

  if (!video) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-hairline bg-surface/50 p-8 text-center">
        <Film className="mb-3 h-8 w-8 text-ink-muted/50" />
        <p className="font-display text-sm font-medium text-ink">No video loaded</p>
        <p className="mt-1 max-w-xs text-xs text-ink-muted">
          Drop a video into the player rail or load the demo project to start spotting lines.
        </p>
      </div>
    );
  }

  return (
    <div className="relative pt-2 pb-6">
      <Rows playerRef={playerRef} onSelect={onSelect} />
    </div>
  );
}
