import { fabric } from "fabric";
import type { AnimationStrategy, UpdateCtx } from "./types";
import type { DigitalMatrixOptions, SubtitleLine } from "../types";
import { clamp } from "../animation";
import { BackgroundLayer } from "./helpers";

const GLITCH = "!@#$%^&*<>/\\|01";

/**
 * Digital Matrix — typed-out reveal with a brief glitch char per slot,
 * heavy glow, slight per-frame jitter on the latest character.
 */
export class DigitalMatrixStrategy implements AnimationStrategy {
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
    const opts = uctx.options as DigitalMatrixOptions;

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
      this.text = new fabric.Textbox("", {
        fontFamily: "'Courier New', monospace",
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
          color: style.activeColor,
          blur: 24 * opts.glowIntensity,
          offsetX: 0,
          offsetY: 0,
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
    const dur = Math.max(0.001, line.end - line.start);
    const elapsed = clamp(currentTime - line.start, 0, dur);
    const n = Math.floor((elapsed / dur) * full.length);
    let display = full.slice(0, n);
    // glitch char at the typing edge
    if (n < full.length && full[n] !== " ") {
      const seed = Math.floor(currentTime * 18) % GLITCH.length;
      display += GLITCH[seed];
    }

    const jitterX =
      (Math.sin(currentTime * 47.3) * opts.glitchAmplitude) | 0;

    this.text.set({
      text: display,
      left: position.x + jitterX,
      top: position.y,
      originY: style.boxAnchor,
      width: style.boxWidth,
      opacity: 1,
      shadow: new fabric.Shadow({
        color: style.activeColor,
        blur: 24 * opts.glowIntensity,
        offsetX: 0,
        offsetY: 0,
      }),
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
