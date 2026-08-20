import { fabric } from "fabric";
import type { AnimationStrategy, UpdateCtx } from "./types";
import type { TickerOptions } from "../types";
import { CANVAS_W } from "../renderer";
import { BackgroundLayer, measureWidth } from "./helpers";

/**
 * Ticker — relentless right-to-left scroll along the bottom of the canvas.
 * Concatenates ALL caption lines into one repeating tape, ignoring per-line
 * timing (all visible always).
 */
export class TickerStrategy implements AnimationStrategy {
  private canvas!: fabric.Canvas;
  private text: fabric.Text | null = null;
  private tapeText: string = "";
  private tapeWidth: number = 0;
  private bg!: BackgroundLayer;

  mount(canvas: fabric.Canvas) {
    this.canvas = canvas;
    this.bg = new BackgroundLayer(canvas);
  }

  update(uctx: UpdateCtx) {
    const { canvas, lines, style, position, currentTime } = uctx;
    const opts = uctx.options as TickerOptions;

    const sep = "   •   ";
    const tape =
      lines.map((l) => l.words.map((w) => w.text).join(" ")).join(sep) + sep;

    if (!this.text || this.tapeText !== tape) {
      if (this.text) canvas.remove(this.text);
      this.tapeText = tape;
      this.tapeWidth = measureWidth(
        tape,
        style.fontSize,
        style.fontFamily,
        style.fontWeight,
      );
      // Repeat tape so it always fills the screen
      const repeats = Math.max(
        2,
        Math.ceil((CANVAS_W * 2) / Math.max(1, this.tapeWidth)) + 1,
      );
      const display = tape.repeat(repeats);
      this.text = new fabric.Text(display, {
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        fontSize: style.fontSize,
        fill: style.activeColor,
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
        paintFirst: "stroke",
        strokeLineJoin: "round",
        originX: "left",
        originY: "center",
        selectable: false,
        evented: false,
        objectCaching: false,
      });
      canvas.add(this.text);
    }

    const offset = (currentTime * opts.speed) % Math.max(1, this.tapeWidth);
    this.text.set({
      left: -offset,
      top: position.y,
      opacity: 1,
    });
    this.text.setCoords();

    // Background spans the canvas width as a strip
    if (style.bgOpacity > 0 && this.text) {
      const fakeStrip = new fabric.Rect({
        left: 0,
        top: position.y - style.fontSize / 2 - style.bgPaddingY,
        width: CANVAS_W,
        height: style.fontSize + style.bgPaddingY * 2,
      });
      this.bg.update(fakeStrip, style);
    } else {
      this.bg.update(null, style);
    }

    canvas.requestRenderAll();
  }

  dispose() {
    if (this.text) this.canvas.remove(this.text);
    this.text = null;
    this.bg?.dispose();
  }
}
