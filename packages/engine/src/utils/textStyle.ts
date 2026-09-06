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
 * Fill color CSS: flat color, gradient (when enabled), or the flat active
 * color. `emphasize` means "render in the active/highlighted state" — each
 * animation maps its own isActive/isVisible/isSettled concept onto it. The
 * active color always stays flat; the gradient only affects the
 * non-emphasized state, so the highlight never fights a two-tone fill (and,
 * as a consequence, an animation whose words are always emphasized — e.g.
 * TickerAnimation — never visibly shows the gradient; that's expected).
 */
export function resolveWordFillCss(style: SubtitleStyle, emphasize: boolean): CSSProperties {
  if (emphasize) return { color: style.activeColor };
  if (!style.textGradientEnabled) return { color: style.color };
  return {
    backgroundImage: `linear-gradient(${style.textGradientAngle}deg, ${style.color}, ${style.textGradientTo})`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
  };
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
