import type { SubtitleStyle, AnimationConfig } from "@captionly/engine";

export interface ExportCapability {
  supported: boolean;
  reason?: string;
}

/**
 * subtitleDrawer.ts (the client WebCodecs canvas renderer) hardcodes one
 * look — word-by-word reveal by time, flat fill, single shadow color — and
 * never reads `animation.type`. This is the only style/animation
 * combination it actually reproduces correctly; everything else silently
 * mis-renders.
 */
export function isClientExportSupported(
  style: SubtitleStyle,
  animation: AnimationConfig,
): ExportCapability {
  if (animation.type !== "colorFill" || animation.options.transition !== "hardCut") {
    return {
      supported: false,
      reason:
        "The client export renders a fixed word-reveal look and ignores the selected animation. Use server export for an accurate result.",
    };
  }
  if (style.textGradientEnabled) {
    return {
      supported: false,
      reason:
        "The client export can't draw gradient text yet. Use server export for an accurate result.",
    };
  }
  if (
    style.shadowColor !== "#000000" ||
    style.shadowOffsetX !== 0 ||
    style.shadowOffsetY !== 0 ||
    style.activeGlowMultiplier !== 1
  ) {
    return {
      supported: false,
      reason:
        "The client export draws a fixed black shadow and ignores shadow color, offset, and active-glow boost. Use server export for an accurate result.",
    };
  }
  return { supported: true };
}
