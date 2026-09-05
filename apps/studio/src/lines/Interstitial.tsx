import { memo } from "react";
import { voidHeight } from "./geometry";
import { useStudioStore } from "@/store";

interface InterstitialProps {
  gapSec: number;
  gapStart: number;
  prevLineId: string | null;
  nextLineId: string | null;
}

/**
 * The boundary between two lines (or before the first / after the last).
 * A butt joint renders as a hairline offering Merge only; a real gap renders
 * as a labelled dashed void offering Add line and, if both neighbours exist,
 * Merge. See spec §4.
 *
 * memo is load-bearing: Rows (LineList.tsx) re-renders at frame rate via
 * useActiveLineId, so every Interstitial in the list would otherwise
 * re-invoke on every frame.
 */
export const Interstitial = memo(function Interstitial({
  gapSec,
  gapStart,
  prevLineId,
  nextLineId,
}: InterstitialProps) {
  const addLine = useStudioStore((s) => s.addLine);
  const mergeLines = useStudioStore((s) => s.mergeLines);
  const canMerge = prevLineId !== null && nextLineId !== null;

  if (gapSec <= 0.001) {
    if (!canMerge) return <div aria-hidden className="ml-6 h-px bg-hairline" />;
    return (
      <button
        type="button"
        onClick={() => mergeLines(prevLineId, nextLineId)}
        aria-label="Merge lines"
        className="group ml-6 flex h-px w-[calc(100%-1.5rem)] items-center justify-center
                   bg-hairline transition-all hover:h-5 hover:bg-edit/30
                   focus-visible:h-5 focus-visible:outline-2 focus-visible:outline-offset-2
                   focus-visible:outline-edit"
      >
        <span className="hidden text-[0.625rem] text-edit group-hover:inline">Merge lines</span>
      </button>
    );
  }

  return (
    <div
      className="ml-6 flex items-center justify-center gap-3 rounded-sm border border-dashed border-hairline"
      style={{ height: voidHeight(gapSec) }}
    >
      <span className="tabular text-[0.6875rem] text-ink-muted">{gapSec.toFixed(2)}s free</span>
      <button
        type="button"
        onClick={() => addLine(prevLineId, gapStart, gapStart + gapSec)}
        className="rounded-sm border border-edit/50 px-2 py-0.5 text-[0.625rem] text-edit
                   transition-colors hover:bg-edit/10 focus-visible:outline-2
                   focus-visible:outline-offset-2 focus-visible:outline-edit"
      >
        Add line
      </button>
      {canMerge && (
        <button
          type="button"
          onClick={() => mergeLines(prevLineId, nextLineId)}
          className="rounded-sm border border-edit/50 px-2 py-0.5 text-[0.625rem] text-edit
                     transition-colors hover:bg-edit/10 focus-visible:outline-2
                     focus-visible:outline-offset-2 focus-visible:outline-edit"
        >
          Merge lines
        </button>
      )}
    </div>
  );
});
