import type { CSSProperties } from "react";
import type { SubtitleStyle } from "../types";

/**
 * Stroke (outline) shadow layers — a ring of solid offset text-shadows
 * ("faux stroke") instead of `-webkit-text-stroke`, which always miters
 * corners and spikes on sharp glyph angles (M/W/A/N) with no CSS way to
 * round the join.
 */
export function strokeShadowLayers(style: SubtitleStyle): string[] {
  if (style.strokeWidth <= 0) return [];
  const steps = 12;
  return Array.from({ length: steps }, (_, i) => {
    const angle = (i / steps) * 2 * Math.PI;
    const x = Math.round(Math.cos(angle) * style.strokeWidth * 10) / 10;
    const y = Math.round(Math.sin(angle) * style.strokeWidth * 10) / 10;
    return `${x}px ${y}px 0 ${style.stroke}`;
  });
}

/**
 * Fill color CSS: flat `color`, or flat `activeColor` while emphasized.
 * `emphasize` means "render in the active/highlighted state" — each
 * animation maps its own isActive/isVisible/isSettled concept onto it.
 */
export function resolveWordFillCss(style: SubtitleStyle, emphasize: boolean): CSSProperties {
  return { color: emphasize ? style.activeColor : style.color };
}

/**
 * Stroke + shadow/glow CSS, combined into a single `textShadow` list since
 * both are implemented as layered shadows and only one `textShadow` can
 * apply per element. Glow color tints toward `activeColor` while emphasized,
 * `shadowColor` otherwise; blur is boosted by `activeGlowMultiplier` only
 * while emphasized.
 */
export function resolveWordOutlineCss(style: SubtitleStyle, emphasize: boolean): CSSProperties {
  const layers = strokeShadowLayers(style);
  if (style.shadowBlur > 0) {
    const blur = style.shadowBlur * (emphasize ? style.activeGlowMultiplier : 1);
    const color = emphasize ? style.activeColor : style.shadowColor;
    layers.push(`${style.shadowOffsetX}px ${style.shadowOffsetY}px ${blur}px ${color}`);
  }
  if (layers.length === 0) return {};
  return { textShadow: layers.join(", ") };
}
