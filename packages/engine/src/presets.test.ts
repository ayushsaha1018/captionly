import { describe, expect, it } from "bun:test";
import { PRESETS } from "./presets";

const STYLE_KEYS = [
  "fontFamily", "fontWeight", "fontSize", "color", "activeColor", "stroke", "strokeWidth",
  "activeScale", "shadowBlur", "shadowColor", "shadowOffsetX", "shadowOffsetY",
  "textGradientEnabled", "textGradientTo", "textGradientAngle", "activeGlowMultiplier",
  "boxWidth", "boxAnchor", "bgColor", "bgOpacity", "bgRadius", "bgPaddingX", "bgPaddingY",
] as const;

describe("PRESETS", () => {
  it("has at least one preset", () => {
    expect(Object.keys(PRESETS).length).toBeGreaterThan(0);
  });

  for (const [key, preset] of Object.entries(PRESETS)) {
    it(`${key} has a label and every SubtitleStyle key`, () => {
      expect(preset.label.length).toBeGreaterThan(0);
      for (const styleKey of STYLE_KEYS) {
        expect(preset.style[styleKey]).not.toBeUndefined();
      }
      expect(preset.animation.type).toBeDefined();
      expect(preset.animation.options).toBeDefined();
    });
  }
});
