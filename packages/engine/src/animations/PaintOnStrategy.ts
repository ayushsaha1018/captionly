import { Canvas, Textbox, Shadow } from "fabric";
import type { AnimationStrategy, UpdateCtx } from "./types";
import type { PaintOnOptions, SubtitleLine } from "../types";
import { BackgroundLayer, cpsForLine } from "./helpers";

/**
 * Paint-On — characters reveal LTR or RTL, paced to fit line duration
 * (capped by maxCps).
 */
export class PaintOnStrategy implements AnimationStrategy {
  private canvas!: Canvas;
  private text: Textbox | null = null;
  private currentLineId: string | null = null;
  private bg!: BackgroundLayer;

  mount(canvas: Canvas) {
    this.canvas = canvas;
    this.bg = new BackgroundLayer(canvas);
  }

  private fullText(line: SubtitleLine): string {
    return line.words.map((w) => w.text).join(" ");
  }

  update(uctx: UpdateCtx) {
    const { canvas, lines, style, position, currentTime } = uctx;
    const opts = uctx.options as PaintOnOptions;

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
      this.text = new Textbox("", {
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
        textAlign: opts.direction === "rtl" ? "right" : "left",
        width: style.boxWidth,
        selectable: true,
        hasControls: false,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        evented: true,
        objectCaching: false,
        shadow: new Shadow({
          color: "rgba(0,0,0,0.6)",
          blur: 8,
          offsetX: 0,
          offsetY: 4,
        }),
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

    const full = this.fullText(line);
    const duration = Math.max(0.001, line.end - line.start);
    const cps = cpsForLine(line.words, duration, opts.maxCps);
    const elapsed = Math.max(0, currentTime - line.start);
    const n = Math.min(full.length, Math.floor(elapsed * cps));
    const visible =
      opts.direction === "rtl"
        ? full.slice(0, n).split("").reverse().join("")
        : full.slice(0, n);

    this.text.set({
      text: visible,
      left: position.x,
      top: position.y,
      width: style.boxWidth,
      originY: style.boxAnchor,
      textAlign: opts.direction === "rtl" ? "right" : "left",
      opacity: 1,
    });
    this.text.setCoords();
    this.bg.update(this.text, style);
    canvas.requestRenderAll();
  }

  private disposeObjects() {
    if (this.text) this.canvas.remove(this.text);
    this.text = null;
  }

  dispose() {
    this.disposeObjects();
    this.bg?.dispose();
    this.currentLineId = null;
  }
}
