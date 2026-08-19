import { fabric } from "fabric";
import type { AnimationStrategy, UpdateCtx } from "./types";
import type { PopOnOptions, SubtitleLine } from "../types";
import { clamp, easeOutCubic } from "../animation";
import { BackgroundLayer } from "./helpers";

/**
 * Pop-On — full caption appears at once with a quick scale "pop".
 */
export class PopOnStrategy implements AnimationStrategy {
  private canvas!: fabric.Canvas;
  private text: fabric.Textbox | null = null;
  private currentLineId: string | null = null;
  private bg!: BackgroundLayer;

  mount(canvas: fabric.Canvas) {
    this.canvas = canvas;
    this.bg = new BackgroundLayer(canvas);
  }

  private fullText(line: SubtitleLine) {
    return line.words.map((w) => w.text).join(" ");
  }

  update(uctx: UpdateCtx) {
    const { canvas, lines, style, position, currentTime } = uctx;
    const opts = uctx.options as PopOnOptions;

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
      this.text = new fabric.Textbox(this.fullText(line), {
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
        shadow: new fabric.Shadow({
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

    const since = currentTime - line.start;
    const t = clamp(since / Math.max(0.05, opts.popDuration), 0, 1);
    const eased = easeOutCubic(t);
    // overshoot then settle: scale goes 0 → popScale → 1
    const scale =
      eased < 0.6
        ? (eased / 0.6) * opts.popScale
        : opts.popScale + (1 - opts.popScale) * ((eased - 0.6) / 0.4);

    this.text.set({
      left: position.x,
      top: position.y,
      originY: style.boxAnchor,
      width: style.boxWidth,
      scaleX: scale,
      scaleY: scale,
      opacity: t,
    });
    this.text.setCoords();
    this.bg.update(this.text, style, t);
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
