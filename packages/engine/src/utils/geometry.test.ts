import { describe, expect, it } from "bun:test";
import { getResolutionScale, calculateSubtitleLayout } from "./geometry";

describe("getResolutionScale", () => {
  it("returns 1.0 for standard 1080p landscape (1920x1080)", () => {
    expect(getResolutionScale(1920, 1080)).toBe(1.0);
  });

  it("returns 1.0 for standard 1080p vertical (1080x1920)", () => {
    expect(getResolutionScale(1080, 1920)).toBe(1.0);
  });

  it("returns 1.0 for square 1080x1080", () => {
    expect(getResolutionScale(1080, 1080)).toBe(1.0);
  });

  it("returns 2.0 for 4K landscape (3840x2160)", () => {
    expect(getResolutionScale(3840, 2160)).toBe(2.0);
  });

  it("returns 2.0 for 4K vertical (2160x3840)", () => {
    expect(getResolutionScale(2160, 3840)).toBe(2.0);
  });

  it("returns 0.667 for 720p vertical (720x1280)", () => {
    const scale = getResolutionScale(720, 1280);
    expect(Math.round(scale * 1000) / 1000).toBe(0.667);
  });
});

describe("calculateSubtitleLayout", () => {
  it("preserves 1400px boxWidth on 1920x1080 landscape", () => {
    const { scale, maxWidth } = calculateSubtitleLayout(1920, 1080, 1400);
    expect(scale).toBe(1.0);
    expect(maxWidth).toBe(1400);
  });

  it("clamps boxWidth to 88% width on 1080x1920 vertical video", () => {
    const { scale, maxWidth } = calculateSubtitleLayout(1080, 1920, 1400);
    expect(scale).toBe(1.0);
    expect(maxWidth).toBe(950.4);
  });

  it("scales boxWidth proportionally on 4K without exceeding 88% width", () => {
    const { scale, maxWidth } = calculateSubtitleLayout(3840, 2160, 1400);
    expect(scale).toBe(2.0);
    expect(maxWidth).toBe(2800);
  });

  it("handles undefined boxWidth by defaulting to 1400 base", () => {
    const { maxWidth } = calculateSubtitleLayout(1920, 1080);
    expect(maxWidth).toBe(1400);
  });

  it("handles non-finite or non-positive dimensions gracefully", () => {
    expect(getResolutionScale(0, 1080)).toBe(1.0);
    expect(getResolutionScale(-100, 1080)).toBe(1.0);
    expect(getResolutionScale(NaN, 1080)).toBe(1.0);
    expect(getResolutionScale(1920, Infinity)).toBe(1.0);
  });

  it("respects smaller custom boxWidth", () => {
    const { maxWidth } = calculateSubtitleLayout(1920, 1080, 800);
    expect(maxWidth).toBe(800);
  });
});

