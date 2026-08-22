import { Canvas, Textbox, Rect } from "fabric";
import type { AnimationStrategy, UpdateCtx } from "./types";
import type { WipeOptions, SubtitleLine } from "../types";
import { clamp } from "../animation";
import { BackgroundLayer } from "./helpers";

/**
 * Wipe — full caption is positioned, a clipping rect sweeps across to reveal.
 * Sweeps across the full line duration.
 */
export class WipeStrategy implements AnimationStrategy {
  private canvas!: Canvas;
  private text: Textbox | null = null;
  private clip: Rect | null = null;
  private currentLineId: string | null = null;
  private bg!: BackgroundLayer;

  mount(canvas: Canvas) {
    this.canvas = canvas;
    this.bg = new BackgroundLayer(canvas);
  }

  private fullText(line: SubtitleLine) {
    return line.words.map((w) => w.text).join(" ");
  }

  update(uctx: UpdateCtx) {
    const { canvas, lines, style, position, currentTime } = uctx;
    const opts = uctx.options as WipeOptions;

    const line =
      lines.find((l) => currentTime >= l.start && currentTime <= l.end) ?? null;
    if (!line) {
      this.text?.set({ opacity: 0 });
      this.bg.update(null, style);
      canvas.requestRenderAll();
      return;
    }

    if (this.currentLineId !== line.id || !this.text) {
      this.disposeObjects();
      this.text = new Textbox(this.fullText(line), {
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        fontSize: style.fontSize,
        fill: style.activeColor,
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
        paintFirst: "stroke",
        strokeLineJoin: "round",
        originX: "center",
        originY: style.boxAnchor,
        textAlign: "center",
        width: style.boxWidth,
        selectable: true,
        hasControls: false,
        lockRotation: true,
        evented: true,
        objectCaching: false,
      });
      this.text.on("moving", () => {
        uctx.onPositionChange({
          x: this.text!.left ?? 0,
          y: this.text!.top ?? 0,
        });
      });
      canvas.add(this.text);
      this.currentLineId = line.id;
    }

    this.text.set({
      left: position.x,
      top: position.y,
      originY: style.boxAnchor,
      width: style.boxWidth,
      opacity: 1,
    });
    this.text.setCoords();

    const dur = Math.max(0.001, line.end - line.start);
    const t = clamp((currentTime - line.start) / dur, 0, 1);
    const bbox = this.text.getBoundingRect();

    // Build a clip rect in canvas coords.
    let clipLeft = bbox.left;
    let clipTop = bbox.top;
    let clipW = bbox.width;
    let clipH = bbox.height;
    if (opts.direction === "ltr") clipW = bbox.width * t;
    else if (opts.direction === "rtl") {
      clipW = bbox.width * t;
      clipLeft = bbox.left + bbox.width - clipW;
    } else if (opts.direction === "ttb") clipH = bbox.height * t;
    else if (opts.direction === "btt") {
      clipH = bbox.height * t;
      clipTop = bbox.top + bbox.height - clipH;
    }

    // Use a clipPath on the text (in absolute coords)
    const cp = new Rect({
      left: clipLeft,
      top: clipTop,
      width: Math.max(0.01, clipW),
      height: Math.max(0.01, clipH),
      absolutePositioned: true,
      originX: "left",
      originY: "top",
    });
    this.text.clipPath = cp;

    this.bg.update(this.text, style);
    canvas.requestRenderAll();
  }

  private disposeObjects() {
    if (this.text) this.canvas.remove(this.text);
    this.text = null;
    this.clip = null;
  }

  dispose() {
    this.disposeObjects();
    this.bg?.dispose();
    this.currentLineId = null;
  }
}
