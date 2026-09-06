/** Number of decimal places implied by a step (e.g. 0.05 -> 2, 1 -> 0). */
export function decimalsFromStep(step: number): number {
  const s = step.toString();
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
}

/** Snaps `value` to the nearest `step` increment, clamped to [min, max], at
 *  the precision implied by `step`. Guards against float drift (0.1 + 0.2). */
export function clampToStep(value: number, min: number, max: number, step: number): number {
  const decimals = decimalsFromStep(step);
  const snapped = Math.round(value / step) * step;
  const clamped = Math.min(max, Math.max(min, snapped));
  return Number(clamped.toFixed(decimals));
}
