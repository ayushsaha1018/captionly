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
  it("emphasized words are the flat active color", () => {
    const style = { ...defaultStyle, activeColor: "#FFD60A" };
    expect(resolveWordFillCss(style, true)).toEqual({ color: "#FFD60A" });
  });

  it("non-emphasized words are the flat color", () => {
    const style = { ...defaultStyle, color: "#ffffff" };
    expect(resolveWordFillCss(style, false)).toEqual({ color: "#ffffff" });
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
