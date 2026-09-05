import type { PlayerRef } from "@remotion/player";
import { Fragment, useCallback, useEffect, useRef } from "react";
import { Film } from "lucide-react";
import { useStudioStore } from "@/store";
import { FPS } from "@/lib/constants";
import { LineRow } from "./LineRow";
import { Interstitial } from "./Interstitial";
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

  const leadingGapSec = lines.length > 0 ? lines[0].start : durationSec;
  const trailingGapSec = lines.length > 0 ? durationSec - lines[lines.length - 1].end : 0;

  return (
    <>
      {(lines.length === 0 || leadingGapSec > 0.001) && (
        <Interstitial
          gapSec={leadingGapSec}
          gapStart={0}
          prevLineId={null}
          nextLineId={lines[0]?.id ?? null}
        />
      )}
      {lines.map((line, i) => (
        <Fragment key={line.id}>
          {i > 0 && (
            <Interstitial
              gapSec={line.start - lines[i - 1].end}
              gapStart={lines[i - 1].end}
              prevLineId={lines[i - 1].id}
              nextLineId={line.id}
            />
          )}
          <div ref={line.id === activeId ? activeRef : undefined}>
            <LineRow
              line={line}
              selected={line.id === selectedLineId}
              active={line.id === activeId}
              nextBoundary={lines[i + 1]?.start ?? durationSec}
              onSelect={onSelect}
              playerRef={playerRef}
            />
          </div>
        </Fragment>
      ))}
      {lines.length > 0 && trailingGapSec > 0.001 && (
        <Interstitial
          gapSec={trailingGapSec}
          gapStart={lines[lines.length - 1].end}
          prevLineId={lines[lines.length - 1].id}
          nextLineId={null}
        />
      )}
    </>
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
    <div className="relative">
      <Rows playerRef={playerRef} onSelect={onSelect} />
    </div>
  );
}
