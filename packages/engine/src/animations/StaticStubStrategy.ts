import { Canvas, Textbox, Shadow } from "fabric";
import type { AnimationStrategy, UpdateCtx } from "./types";

/**
 * V2 placeholder: renders the active line as a static text block.
 * Implements the strategy contract so the UI option is selectable
 * without crashing while the real animation is built later.
 */
export class StaticStubStrategy implements AnimationStrategy {
  private canvas!: Canvas;
  private text: Textbox | null = null;
  private currentLineId: string | null = null;
  private label: string;

  constructor(label: string) {
    this.label = label;
  }

  mount(canvas: Canvas) {
    this.canvas = canvas;
  }

  update(ctx: UpdateCtx) {
    const { canvas, lines, style, position, currentTime } = ctx;
    const line =
      lines.find((l) => currentTime >= l.start && currentTime <= l.end) ?? null;

    if (!line) {
      this.text?.set({ opacity: 0 });
      canvas.requestRenderAll();
      return;
    }

    if (this.currentLineId !== line.id || !this.text) {
      if (this.text) this.canvas.remove(this.text);
      this.text = new Textbox(line.words.map((w) => w.text).join(" "), {
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        fontSize: style.fontSize,
        fill: style.activeColor,
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
        paintFirst: "stroke",
        strokeLineJoin: "round",
        originX: "center",
        originY: "center",
        textAlign: "center",
        width: 1600,
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
        ctx.onPositionChange({
          x: this.text!.left ?? 0,
          y: this.text!.top ?? 0,
        });
      });
      canvas.add(this.text);
      this.currentLineId = line.id;
    }

    this.text.set({ left: position.x, top: position.y, opacity: 1 });
    this.text.setCoords();
    canvas.requestRenderAll();
  }

  dispose() {
    if (this.text) this.canvas.remove(this.text);
    this.text = null;
    this.currentLineId = null;
  }
}
