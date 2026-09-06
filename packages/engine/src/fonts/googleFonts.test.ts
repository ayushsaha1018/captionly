import { describe, expect, it } from "bun:test";
import {
  getAvailableGoogleFonts,
  getGoogleFontNames,
  findGoogleFont,
  loadGoogleFont,
  POPULAR_GOOGLE_FONTS,
} from "./googleFonts";

describe("googleFonts", () => {
  it("loads the full list of Google Fonts from @remotion/google-fonts", () => {
    const fonts = getAvailableGoogleFonts();
    expect(fonts.length).toBeGreaterThan(1500);

    const names = getGoogleFontNames();
    expect(names.length).toBe(fonts.length);
    expect(names).toContain("Inter");
    expect(names).toContain("Roboto");
    expect(names).toContain("Montserrat");
  });

  it("exports a valid list of popular Google fonts", () => {
    expect(POPULAR_GOOGLE_FONTS.length).toBeGreaterThan(10);
    expect(POPULAR_GOOGLE_FONTS).toContain("Inter");
    expect(POPULAR_GOOGLE_FONTS).toContain("Roboto");
    expect(POPULAR_GOOGLE_FONTS).toContain("Poppins");
  });

  it("finds fonts case-insensitively and by import name", () => {
    const inter = findGoogleFont("inter");
    expect(inter?.fontFamily).toBe("Inter");

    const robotoMono = findGoogleFont("RobotoMono");
    expect(robotoMono?.fontFamily).toBe("Roboto Mono");
  });

  it("strips legacy comma-separated font fallbacks and quotes", () => {
    const inter = findGoogleFont("Inter, system-ui, -apple-system, sans-serif");
    expect(inter?.fontFamily).toBe("Inter");

    const roboto = findGoogleFont("'Roboto', sans-serif");
    expect(roboto?.fontFamily).toBe("Roboto");
  });

  it("falls back safely to Inter when given an empty or unknown font", () => {
    const empty = findGoogleFont("");
    expect(empty?.fontFamily).toBe("Inter");

    const unknown = findGoogleFont("SomeTotallyNonExistentFont123");
    expect(unknown?.fontFamily).toBe("Inter");
  });

  it("loads a font and caches the resulting promise", async () => {
    const p1 = loadGoogleFont("Inter", { weights: ["400"] });
    const p2 = loadGoogleFont("Inter", { weights: ["400"] });
    expect(p1).toBe(p2);
    await p1;
  });

  it("handles fonts with limited available weights without throwing", async () => {
    // Lobster only has weight 400
    await expect(loadGoogleFont("Lobster", { weights: ["900"] })).resolves.toBeUndefined();
  });
});
