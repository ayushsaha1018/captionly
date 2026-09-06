import React, { useEffect } from "react";
import { delayRender, continueRender } from "remotion";
import { getAvailableFonts } from "@remotion/google-fonts";

export type AvailableGoogleFont = ReturnType<typeof getAvailableFonts>[number];

let cachedFonts: AvailableGoogleFont[] | null = null;

/**
 * Returns all available Google Fonts from @remotion/google-fonts (~1,833 fonts).
 */
export function getAvailableGoogleFonts(): AvailableGoogleFont[] {
  if (!cachedFonts) {
    cachedFonts = getAvailableFonts();
  }
  return cachedFonts;
}

let cachedFontNames: string[] | null = null;

/**
 * Returns an array of all Google Font family names.
 */
export function getGoogleFontNames(): string[] {
  if (!cachedFontNames) {
    cachedFontNames = getAvailableGoogleFonts().map((f) => f.fontFamily);
  }
  return cachedFontNames;
}

/**
 * Curated list of popular Google Fonts for fast selection.
 */
export const POPULAR_GOOGLE_FONTS = [
  "Inter",
  "Roboto",
  "Montserrat",
  "Poppins",
  "Oswald",
  "Open Sans",
  "Lato",
  "Playfair Display",
  "Space Grotesk",
  "JetBrains Mono",
  "Anton",
  "Pacifico",
  "Bebas Neue",
  "Lobster",
  "Courier Prime",
  "Share Tech Mono",
  "Work Sans",
  "Fira Sans",
  "Merriweather",
  "Nunito",
  "Rubik",
  "Bangers",
  "Kanit",
  "Cinzel",
  "Caveat",
];

/**
 * Find a Google font by family name or import name (case-insensitive).
 * Safely strips legacy font fallbacks (e.g. "Inter, system-ui..." -> "Inter")
 * and defaults to "Inter" if no match is found.
 */
export function findGoogleFont(name: string): AvailableGoogleFont | undefined {
  const fonts = getAvailableGoogleFonts();
  if (!name) {
    return fonts.find((f) => f.fontFamily === "Inter");
  }

  const trimmed = name.trim();
  const directMatch = fonts.find(
    (f) =>
      f.fontFamily.toLowerCase() === trimmed.toLowerCase() ||
      f.importName.toLowerCase() === trimmed.toLowerCase(),
  );
  if (directMatch) return directMatch;

  // Strip fallbacks and quotes, e.g. "'Courier New', monospace" or "Inter, system-ui..."
  const cleanName = trimmed
    .split(",")[0]
    .replace(/['"]/g, "")
    .trim();

  const cleanMatch = fonts.find(
    (f) =>
      f.fontFamily.toLowerCase() === cleanName.toLowerCase() ||
      f.importName.toLowerCase() === cleanName.toLowerCase(),
  );
  if (cleanMatch) return cleanMatch;

  // Fallback to Inter
  return fonts.find((f) => f.fontFamily === "Inter");
}

const fontLoadPromises = new Map<string, Promise<void>>();

const NOOP_PROMISE = Promise.resolve();

/**
 * Dynamically loads a Google Font via @remotion/google-fonts.
 * Ensures requested weights are valid for the font, and caches completed loads.
 */
export function loadGoogleFont(
  fontFamily: string,
  options?: { weights?: string[]; subsets?: string[] },
): Promise<void> {
  if (typeof window === "undefined" && typeof FontFace === "undefined") {
    return NOOP_PROMISE;
  }
  const fontEntry = findGoogleFont(fontFamily);
  if (!fontEntry) return NOOP_PROMISE;

  const weightsKey = options?.weights?.sort().join(",") || "all";
  const subsetsKey = options?.subsets?.sort().join(",") || "latin";
  const cacheKey = `${fontEntry.fontFamily}-${weightsKey}-${subsetsKey}`;

  const cached = fontLoadPromises.get(cacheKey);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    try {
      const mod = await fontEntry.load();
      const info = mod.getInfo?.();
      const availableNormalWeights = info?.fonts?.normal ? Object.keys(info.fonts.normal) : [];

      let weightsToLoad: string[] | undefined = undefined;
      if (options?.weights && options.weights.length > 0) {
        if (availableNormalWeights.length > 0) {
          const matched = options.weights.filter((w) => availableNormalWeights.includes(w));
          weightsToLoad = matched.length > 0 ? matched : [availableNormalWeights[0]];
        } else {
          weightsToLoad = options.weights;
        }
      } else if (availableNormalWeights.length > 0) {
        weightsToLoad = availableNormalWeights;
      }

      const subsetsToLoad = options?.subsets || ["latin"];
      const res = mod.loadFont("normal", {
        weights: weightsToLoad,
        subsets: subsetsToLoad,
      });

      if (res?.waitUntilDone) {
        await res.waitUntilDone();
      }
    } catch (err) {
      console.warn(`Failed to load Google Font "${fontFamily}":`, err);
    }
  })();

  fontLoadPromises.set(cacheKey, promise);
  return promise;
}

/**
 * Remotion-aware component that delays rendering until the specified Google Font is loaded.
 */
export const GoogleFontLoader: React.FC<{
  fontFamily: string;
  fontWeight?: number | string;
}> = ({ fontFamily, fontWeight }) => {
  useEffect(() => {
    const handle = delayRender(`Loading Google Font: ${fontFamily}`);
    let active = true;

    loadGoogleFont(fontFamily, {
      weights: fontWeight ? [String(fontWeight)] : undefined,
    }).finally(() => {
      if (active) {
        continueRender(handle);
      }
    });

    return () => {
      active = false;
      continueRender(handle);
    };
  }, [fontFamily, fontWeight]);

  return null;
};
