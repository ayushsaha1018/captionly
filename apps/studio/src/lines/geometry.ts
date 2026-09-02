export const PX_PER_SEC = 28;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Line blocks are proportional to duration but clamped, so a long line
 *  stays legible and a 10-minute video is not a scroll marathon. */
export const lineHeight = (durationSec: number) =>
  Math.round(clamp(durationSec * PX_PER_SEC, 72, 200));

/** Gaps render as voids sized to their duration, clamped tighter than lines. */
export const voidHeight = (gapSec: number) => Math.round(clamp(gapSec * PX_PER_SEC, 24, 120));
