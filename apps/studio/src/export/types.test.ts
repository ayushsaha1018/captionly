import { describe, expect, test } from "bun:test";
import { calculateVideoBitrate } from "./types";

describe("calculateVideoBitrate", () => {
  test("uses the 1080p floor without a source bitrate or for low-bitrate sources", () => {
    expect(calculateVideoBitrate(1920, 1080)).toBe(12_000_000);
    expect(calculateVideoBitrate(1920, 1080, 3_000_000)).toBe(12_000_000);
  });

  test("aims 1.2x above the source bitrate between floor and cap", () => {
    expect(calculateVideoBitrate(1920, 1080, 16_000_000)).toBe(19_200_000);
  });

  test("caps high-bitrate sources", () => {
    expect(calculateVideoBitrate(1920, 1080, 80_000_000)).toBe(25_000_000);
  });

  test("scales floor with resolution", () => {
    expect(calculateVideoBitrate(3840, 2160)).toBeGreaterThan(40_000_000);
  });
});
