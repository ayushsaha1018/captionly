import { describe, expect, it } from "bun:test";
import { defaultStyle } from "../sampleData";
import { resolveWordFillCss, resolveWordShadowCss, resolveWordStrokeCss } from "./textStyle";

describe("resolveWordStrokeCss", () => {
  it("returns nothing when strokeWidth is 0", () => {
    expect(resolveWordStrokeCss({ ...defaultStyle, strokeWidth: 0 })).toEqual({});
  });

  it("returns a webkit text stroke and paint order otherwise", () => {
    const css = resolveWordStrokeCss({ ...defaultStyle, strokeWidth: 6, stroke: "#111111" });
    expect(css.WebkitTextStroke).toBe("6px #111111");
    expect(css.paintOrder).toBe("stroke fill");
  });
});

describe("resolveWordFillCss", () => {
  it("emphasized words are always the flat active color, gradient or not", () => {
    const style = { ...defaultStyle, textGradientEnabled: true, activeColor: "#FFD60A" };
    expect(resolveWordFillCss(style, true)).toEqual({ color: "#FFD60A" });
  });

  it("non-emphasized words are the flat color when gradient is disabled", () => {
    const style = { ...defaultStyle, textGradientEnabled: false, color: "#ffffff" };
    expect(resolveWordFillCss(style, false)).toEqual({ color: "#ffffff" });
  });

  it("non-emphasized words gradient-fill from color to textGradientTo when enabled", () => {
    const style = {
      ...defaultStyle,
      textGradientEnabled: true,
      color: "#ffffff",
      textGradientTo: "#ff00ff",
      textGradientAngle: 45,
    };
    const css = resolveWordFillCss(style, false);
    expect(css.backgroundImage).toBe("linear-gradient(45deg, #ffffff, #ff00ff)");
    expect(css.WebkitBackgroundClip).toBe("text");
    expect(css.backgroundClip).toBe("text");
    expect(css.WebkitTextFillColor).toBe("transparent");
  });
});

describe("resolveWordShadowCss", () => {
  it("returns nothing when shadowBlur is 0", () => {
    expect(resolveWordShadowCss({ ...defaultStyle, shadowBlur: 0 }, false)).toEqual({});
  });

  it("uses shadowColor and unmultiplied blur when not emphasized", () => {
    const style = { ...defaultStyle, shadowBlur: 10, shadowColor: "#000000", shadowOffsetX: 2, shadowOffsetY: 3, activeGlowMultiplier: 2 };
    expect(resolveWordShadowCss(style, false).textShadow).toBe("2px 3px 10px #000000");
  });

  it("uses activeColor and multiplied blur when emphasized", () => {
    const style = { ...defaultStyle, shadowBlur: 10, activeColor: "#FFD60A", shadowOffsetX: 0, shadowOffsetY: 0, activeGlowMultiplier: 2 };
    expect(resolveWordShadowCss(style, true).textShadow).toBe("0px 0px 20px #FFD60A");
  });
});
