import { describe, expect, it } from "bun:test";
import { clampToStep, decimalsFromStep } from "./numberField";

describe("decimalsFromStep", () => {
  it("returns 0 for whole-number steps", () => {
    expect(decimalsFromStep(1)).toBe(0);
    expect(decimalsFromStep(20)).toBe(0);
  });

  it("counts decimal places for fractional steps", () => {
    expect(decimalsFromStep(0.1)).toBe(1);
    expect(decimalsFromStep(0.05)).toBe(2);
  });
});

describe("clampToStep", () => {
  it("snaps to the nearest step", () => {
    expect(clampToStep(83, 32, 160, 2)).toBe(84);
    expect(clampToStep(1.02, 1, 2, 0.05)).toBe(1);
  });

  it("clamps to min/max", () => {
    expect(clampToStep(-10, 0, 20, 1)).toBe(0);
    expect(clampToStep(999, 0, 20, 1)).toBe(20);
  });

  it("avoids float drift at fractional steps", () => {
    expect(clampToStep(1.15, 1, 2, 0.05)).toBe(1.15);
    expect(clampToStep(0.3, 0, 1, 0.1)).toBe(0.3);
  });
});
