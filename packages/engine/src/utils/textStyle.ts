import type { CSSProperties } from "react";
import type { SubtitleStyle } from "../types";

/** Stroke (outline) CSS — identical across every animation renderer today. */
export function resolveWordStrokeCss(style: SubtitleStyle): CSSProperties {
  if (style.strokeWidth <= 0) return {};
  return {
    WebkitTextStroke: `${style.strokeWidth}px ${style.stroke}`,
    paintOrder: "stroke fill",
  };
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
 * Shadow/glow CSS. Color tints toward `activeColor` while emphasized,
 * `shadowColor` otherwise. Blur is boosted by `activeGlowMultiplier` only
 * while emphasized.
 */
export function resolveWordShadowCss(style: SubtitleStyle, emphasize: boolean): CSSProperties {
  if (style.shadowBlur <= 0) return {};
  const blur = style.shadowBlur * (emphasize ? style.activeGlowMultiplier : 1);
  const color = emphasize ? style.activeColor : style.shadowColor;
  return {
    textShadow: `${style.shadowOffsetX}px ${style.shadowOffsetY}px ${blur}px ${color}`,
  };
}
