import { test, expect } from "bun:test";
import { defaultStyle, defaultAnimation } from "@captionly/engine";
import { isClientExportSupported } from "./exportCapability";

test("hardCut colorFill with no gradient is supported", () => {
  expect(isClientExportSupported(defaultStyle, defaultAnimation).supported).toBe(true);
});

test("any non-colorFill animation is unsupported", () => {
  const result = isClientExportSupported(defaultStyle, {
    type: "typewriter",
    options: { cursor: "|", blinkRate: 1.4, maxCps: 35 },
  });
  expect(result.supported).toBe(false);
  expect(result.reason).toBeDefined();
});

test("colorFill with a gradient transition is unsupported", () => {
  const result = isClientExportSupported(defaultStyle, {
    type: "colorFill",
    options: { transition: "gradient" },
  });
  expect(result.supported).toBe(false);
  expect(result.reason).toBeDefined();
  expect(result.reason!.length).toBeGreaterThan(0);
});

test("enabled text gradient is unsupported even with colorFill hardCut", () => {
  const style = { ...defaultStyle, textGradientEnabled: true };
  const result = isClientExportSupported(style, defaultAnimation);
  expect(result.supported).toBe(false);
  expect(result.reason).toBeDefined();
  expect(result.reason!.length).toBeGreaterThan(0);
});
