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
  const activeId = useActiveLineId(playerRef);
  const activeRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll keyed on the active id, so this fires once per line change
  // rather than once per frame.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={line.id}>
          {i > 0 && <Interstitial gapSec={line.start - lines[i - 1].end} />}
          <div ref={line.id === activeId ? activeRef : undefined}>
            <LineRow
              line={line}
              selected={line.id === selectedLineId}
              active={line.id === activeId}
              onSelect={onSelect}
              playerRef={playerRef}
            />
          </div>
        </Fragment>
      ))}
    </>
  );
}

export function LineList({ playerRef }: { playerRef: React.RefObject<PlayerRef | null> }) {
  const video = useStudioStore((s) => s.video);
  const lines = useStudioStore((s) => s.lines);
  const select = useStudioStore((s) => s.select);

  // One click selects AND seeks — spec §"one click does everything".
  const onSelect = useCallback(
    (id: string) => {
      select(id);
      const line = useStudioStore.getState().lines.find((l) => l.id === id);
      if (line) playerRef.current?.seekTo(Math.round(line.start * FPS));
    },
    [select, playerRef],
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

  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-hairline p-12 text-center">
        <p className="font-display text-lg">No lines yet.</p>
        <p className="mt-1 text-sm text-ink-muted">Add one at the playhead, or load the demo.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <Rows playerRef={playerRef} onSelect={onSelect} />
    </div>
  );
}
