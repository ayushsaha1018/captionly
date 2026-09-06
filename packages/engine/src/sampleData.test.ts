import { describe, expect, it } from "bun:test";
import { defaultStyle } from "./sampleData";

describe("defaultStyle", () => {
  it("ships the SP4 style-surface defaults, reproducing today's rendering when unused", () => {
    expect(defaultStyle.shadowColor).toBe("#000000");
    expect(defaultStyle.shadowOffsetX).toBe(0);
    expect(defaultStyle.shadowOffsetY).toBe(0);
    expect(defaultStyle.textGradientEnabled).toBe(false);
    expect(defaultStyle.textGradientTo).toBe("#FFD60A");
    expect(defaultStyle.textGradientAngle).toBe(90);
    expect(defaultStyle.activeGlowMultiplier).toBe(1);
  });
});
