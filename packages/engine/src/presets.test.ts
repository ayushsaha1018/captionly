import { describe, expect, it } from "bun:test";
import { PRESETS } from "./presets";
import type { SubtitleStyle } from "./types";

// A missing or extra key here is a TypeScript error, so STYLE_KEYS can't
// silently drift from SubtitleStyle when a field is added or removed.
const STYLE_KEY_MAP: Record<keyof SubtitleStyle, true> = {
  fontFamily: true,
  fontWeight: true,
  fontSize: true,
  color: true,
  activeColor: true,
  stroke: true,
  strokeWidth: true,
  activeScale: true,
  shadowBlur: true,
  shadowColor: true,
  shadowOffsetX: true,
  shadowOffsetY: true,
  activeGlowMultiplier: true,
  boxWidth: true,
  boxAnchor: true,
  bgColor: true,
  bgOpacity: true,
  bgRadius: true,
  bgPaddingX: true,
  bgPaddingY: true,
};

const STYLE_KEYS = Object.keys(STYLE_KEY_MAP) as (keyof SubtitleStyle)[];

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
