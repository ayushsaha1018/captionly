import { describe, expect, it } from "bun:test";
import {
  ANIMATION_LABELS,
  PRESETS,
  defaultAnimation,
  defaultOptionsFor,
  defaultStyle,
} from "../index";

describe("NoneAnimation (Simple SRT)", () => {
  it("has 'none' registered in ANIMATION_LABELS", () => {
    expect(ANIMATION_LABELS.none).toBe("None (Simple SRT)");
  });

  it("defaults defaultAnimation to 'none'", () => {
    expect(defaultAnimation).toEqual({
      type: "none",
      options: {},
    });
  });

  it("defaults defaultStyle to 54px fontSize and matching colors without per-word scale", () => {
    expect(defaultStyle.fontSize).toBe(54);
    expect(defaultStyle.activeColor).toBe(defaultStyle.color);
    expect(defaultStyle.activeScale).toBe(1);
  });

  it("returns empty options for 'none' animation", () => {
    expect(defaultOptionsFor("none")).toEqual({});
  });

  it("includes simpleSrt in presets", () => {
    const preset = PRESETS.simpleSrt;
    expect(preset).toBeDefined();
    expect(preset.label).toBe("Simple SRT");
    expect(preset.animation.type).toBe("none");
    expect(preset.style.fontSize).toBe(54);
    expect(preset.style.activeScale).toBe(1);
    expect(preset.style.activeGlowMultiplier).toBe(1);
  });
});
