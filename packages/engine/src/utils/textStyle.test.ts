import { describe, expect, it } from "bun:test";
import { defaultStyle } from "../sampleData";
import { resolveWordFillCss, resolveWordOutlineCss, strokeShadowLayers } from "./textStyle";

describe("strokeShadowLayers", () => {
  it("returns nothing when strokeWidth is 0", () => {
    expect(strokeShadowLayers({ ...defaultStyle, strokeWidth: 0 })).toEqual([]);
  });

  it("returns a ring of offset solid shadows otherwise", () => {
    const layers = strokeShadowLayers({ ...defaultStyle, strokeWidth: 6, stroke: "#111111" });
    expect(layers.length).toBe(12);
    expect(layers[0]).toBe("6px 0px 0 #111111");
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

describe("resolveWordOutlineCss", () => {
  it("returns nothing when strokeWidth and shadowBlur are both 0", () => {
    expect(
      resolveWordOutlineCss({ ...defaultStyle, strokeWidth: 0, shadowBlur: 0 }, false),
    ).toEqual({});
  });

  it("appends shadowColor and unmultiplied blur as the last layer when not emphasized", () => {
    const style = {
      ...defaultStyle,
      strokeWidth: 0,
      shadowBlur: 10,
      shadowColor: "#000000",
      shadowOffsetX: 2,
      shadowOffsetY: 3,
      activeGlowMultiplier: 2,
    };
    expect(resolveWordOutlineCss(style, false).textShadow).toBe("2px 3px 10px #000000");
  });

  it("uses activeColor and multiplied blur when emphasized", () => {
    const style = {
      ...defaultStyle,
      strokeWidth: 0,
      shadowBlur: 10,
      activeColor: "#FFD60A",
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      activeGlowMultiplier: 2,
    };
    expect(resolveWordOutlineCss(style, true).textShadow).toBe("0px 0px 20px #FFD60A");
  });

  it("combines stroke layers with the glow layer", () => {
    const style = {
      ...defaultStyle,
      strokeWidth: 6,
      stroke: "#111111",
      shadowBlur: 10,
      shadowColor: "#000000",
      shadowOffsetX: 2,
      shadowOffsetY: 3,
      activeGlowMultiplier: 2,
    };
    const css = resolveWordOutlineCss(style, false);
    const layers = (css.textShadow as string).split(", ");
    expect(layers.length).toBe(13);
    expect(layers[0]).toBe("6px 0px 0 #111111");
    expect(layers[12]).toBe("2px 3px 10px #000000");
  });
});
