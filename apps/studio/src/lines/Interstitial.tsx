import { voidHeight } from "./geometry";

/**
 * The boundary between two lines. A butt joint renders as a hairline; a gap
 * renders as a labelled dashed void sized to its duration.
 *
 * Sub-project 1 is VISUAL ONLY. The "Merge lines" and "Add line" controls
 * this hosts arrive in sub-project 3.
 */
export function Interstitial({ gapSec }: { gapSec: number }) {
  if (gapSec <= 0.001) {
    return <div aria-hidden className="ml-6 h-px bg-hairline" />;
  }

  return (
    <div
      className="ml-6 flex items-center justify-center rounded-sm border border-dashed border-hairline"
      style={{ height: voidHeight(gapSec) }}
    >
      <span className="tabular text-[0.6875rem] text-ink-muted">
        {gapSec.toFixed(2)}s free
      </span>
    </div>
  );
}
