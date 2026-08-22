import { Canvas, Rect, FabricObject, getFabricDocument } from "fabric";
import type { BoxAnchor, SubtitleStyle } from "../types";

/**
 * Map BoxAnchor → fabric originY value so the box grows in the right direction
 * while staying anchored at position.y.
 *  - top    : box top sits at position.y, grows downward
 *  - bottom : box bottom sits at position.y, grows upward
 *  - center : box centered around position.y
 */
export function originYFor(anchor: BoxAnchor): "top" | "center" | "bottom" {
  return anchor;
}

/**
 * Compute total characters in a logical line (words joined by spaces).
 */
export function lineCharCount(words: { text: string }[]): number {
  return words.reduce((acc, w, i) => acc + w.text.length + (i > 0 ? 1 : 0), 0);
}

/**
 * Effective characters-per-second so a line completes within its duration,
 * but never faster than maxCps.
 */
export function cpsForLine(
  words: { text: string }[],
  duration: number,
  maxCps: number,
): number {
  const chars = lineCharCount(words);
  if (duration <= 0) return maxCps;
  return Math.min(maxCps, chars / Math.max(0.05, duration));
}

/**
 * Manages a single rounded background rect placed behind a fabric object.
 * Pure-state: call `update(target)` each frame; call `dispose()` on teardown.
 */
export class BackgroundLayer {
  private canvas: Canvas;
  private rect: Rect | null = null;

  constructor(canvas: Canvas) {
    this.canvas = canvas;
  }

  update(target: FabricObject | null, style: SubtitleStyle, opacity = 1) {
    if (!target || style.bgOpacity <= 0) {
      if (this.rect) this.rect.set({ opacity: 0 });
      return;
    }
    const bbox = target.getBoundingRect();
    if (!this.rect) {
      this.rect = new Rect({
        selectable: false,
        evented: false,
        objectCaching: false,
        rx: style.bgRadius,
        ry: style.bgRadius,
      });
      this.canvas.add(this.rect);
      // Keep it under the text
      this.canvas.sendObjectToBack(this.rect);
    }
    this.rect.set({
      left: bbox.left - style.bgPaddingX,
      top: bbox.top - style.bgPaddingY,
      width: bbox.width + style.bgPaddingX * 2,
      height: bbox.height + style.bgPaddingY * 2,
      rx: style.bgRadius,
      ry: style.bgRadius,
      fill: style.bgColor,
      opacity: style.bgOpacity * opacity,
    });
    this.canvas.sendObjectToBack(this.rect);
    this.rect.setCoords();
  }

  dispose() {
    if (this.rect) this.canvas.remove(this.rect);
    this.rect = null;
  }
}

/**
 * Greedy word-wrap using a measurement canvas so we can wrap pre-measured
 * text without relying on fabric.Textbox internals.
 */
let measureCtx:
  CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
function ctx(): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  if (measureCtx) return measureCtx;
  try {
    const doc = getFabricDocument();
    if (doc && typeof doc.createElement === "function") {
      const c = doc.createElement("canvas") as HTMLCanvasElement;
      measureCtx = c.getContext("2d");
    }
  } catch {
    // fallback if environment not initialized yet
  }
  if (!measureCtx) {
    if (typeof document !== "undefined") {
      const c = document.createElement("canvas");
      measureCtx = c.getContext("2d")!;
    } else if (typeof OffscreenCanvas !== "undefined") {
      const c = new OffscreenCanvas(1, 1);
      measureCtx = c.getContext("2d")!;
    }
  }
  return measureCtx!;
}

export function measureWidth(
  text: string,
  fontPx: number,
  family: string,
  weight: number,
): number {
  const c = ctx();
  c.font = `${weight} ${fontPx}px ${family}`;
  return c.measureText(text).width;
}

export function wrapTextToLines(
  text: string,
  maxWidth: number,
  fontPx: number,
  family: string,
  weight: number,
): string[] {
  const words = text.split(/(\s+)/); // keep spaces
  const lines: string[] = [];
  let cur = "";
  for (const tok of words) {
    if (!tok) continue;
    const test = cur + tok;
    if (
      measureWidth(test.trimEnd(), fontPx, family, weight) > maxWidth &&
      cur.trim().length
    ) {
      lines.push(cur.trimEnd());
      cur = tok.trimStart();
    } else {
      cur = test;
    }
  }
  if (cur.trim().length) lines.push(cur.trimEnd());
  return lines;
}
