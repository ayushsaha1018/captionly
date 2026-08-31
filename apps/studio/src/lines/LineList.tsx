import type { PlayerRef } from "@remotion/player";
import { Fragment, useCallback } from "react";
import { useStudioStore } from "@/store";
import { FPS } from "@/lib/constants";
import { LineRow } from "./LineRow";
import { Interstitial } from "./Interstitial";
import { Playhead } from "./Playhead";

export function LineList({
  playerRef,
}: {
  playerRef: React.RefObject<PlayerRef | null>;
}) {
  const lines = useStudioStore((s) => s.lines);
  const selectedLineId = useStudioStore((s) => s.selectedLineId);
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

  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-hairline p-12 text-center">
        <p className="font-display text-lg">No lines yet.</p>
        <p className="mt-1 text-sm text-ink-muted">
          Add one at the playhead, or load the demo.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <Playhead playerRef={playerRef} />
      {lines.map((line, i) => (
        <Fragment key={line.id}>
          {i > 0 && <Interstitial gapSec={line.start - lines[i - 1].end} />}
          <LineRow
            line={line}
            selected={line.id === selectedLineId}
            active={false}
            onSelect={onSelect}
          />
        </Fragment>
      ))}
    </div>
  );
}
