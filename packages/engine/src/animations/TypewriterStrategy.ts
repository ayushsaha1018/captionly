import { Canvas, FabricText, Shadow } from "fabric";
import type { AnimationStrategy, UpdateCtx } from "./types";
import type { TypewriterOptions, SubtitleLine, SubtitleStyle } from "../types";
import {
  BackgroundLayer,
  cpsForLine,
  measureWidth,
  wrapTextToLines,
} from "./helpers";

/**
 * Typewriter — characters reveal one-by-one, finishing within line duration
 * (capped by maxCps). Cursor blinks at the current write position.
 */
export class TypewriterStrategy implements AnimationStrategy {
  private canvas!: Canvas;
  private text: FabricText | null = null;
  private cursor: FabricText | null = null;
  private currentLineId: string | null = null;
  private bg!: BackgroundLayer;

  mount(canvas: Canvas) {
    this.canvas = canvas;
    this.bg = new BackgroundLayer(canvas);
  }

  private fullText(line: SubtitleLine): string {
    return line.words.map((w) => w.text).join(" ");
  }

  private originY(style: SubtitleStyle) {
    return style.boxAnchor;
  }

  update(uctx: UpdateCtx) {
    const { canvas, lines, style, position, currentTime } = uctx;
    const opts = uctx.options as TypewriterOptions;

    const line =
      lines.find((l) => currentTime >= l.start && currentTime <= l.end) ?? null;

    if (!line) {
      this.text?.set({ opacity: 0 });
      this.cursor?.set({ opacity: 0 });
      this.bg.update(null, style);
      canvas.requestRenderAll();
      return;
    }

    if (this.currentLineId !== line.id || !this.text) {
      this.disposeObjects();
      this.text = new FabricText("", {
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        fontSize: style.fontSize,
        fill: style.activeColor,
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
        paintFirst: "stroke",
        strokeLineJoin: "round",
        originX: "center",
        originY: this.originY(style),
        textAlign: "center",
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
      this.cursor = new FabricText(opts.cursor, {
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        fontSize: style.fontSize,
        fill: style.activeColor,
        originX: "left",
        originY: "center",
        selectable: false,
        evented: false,
      });
      this.text.on("moving", () => {
        uctx.onPositionChange({
          x: this.text!.left ?? 0,
          y: this.text!.top ?? 0,
        });
      });
      canvas.add(this.text);
      canvas.add(this.cursor);
      this.currentLineId = line.id;
    }

    const full = this.fullText(line);
    const duration = Math.max(0.001, line.end - line.start);
    const cps = cpsForLine(line.words, duration, opts.maxCps);
    const elapsed = Math.max(0, currentTime - line.start);
    const n = Math.min(full.length, Math.floor(elapsed * cps));
    const visible = full.slice(0, n);

    // Wrap visible substring into visual lines using boxWidth
    const wrapped = wrapTextToLines(
      visible,
      style.boxWidth,
      style.fontSize,
      style.fontFamily,
      style.fontWeight,
    );
    const display = wrapped.length ? wrapped.join("\n") : "";
    this.text.set({
      text: display,
      left: position.x,
      top: position.y,
      originY: this.originY(style),
    });
    this.text.setCoords();

    // Compute cursor position: end of the last visual line
    const lineHeight = style.fontSize * 1.16;
    const lastLine = (wrapped.length && wrapped[wrapped.length - 1]) || "";
    const lastLineWidth = measureWidth(
      lastLine,
      style.fontSize,
      style.fontFamily,
      style.fontWeight,
    );
    const totalH = Math.max(1, wrapped.length) * lineHeight;
    // top edge of the text box in canvas coords
    const topEdge =
      style.boxAnchor === "top"
        ? position.y
        : style.boxAnchor === "bottom"
          ? position.y - totalH
          : position.y - totalH / 2;
    const lastLineCenterY =
      topEdge + (Math.max(1, wrapped.length) - 0.5) * lineHeight;
    const cursorX = position.x + lastLineWidth / 2 + 4;

    const blinkOn = Math.floor(currentTime * opts.blinkRate * 2) % 2 === 0;
    const lineDone = n >= full.length;
    if (this.cursor) {
      this.cursor.set({
        text: opts.cursor,
        opacity: lineDone ? (blinkOn ? 0.6 : 0) : blinkOn ? 1 : 0,
        left: cursorX,
        top: lastLineCenterY,
      });
    }
    this.text.set({ opacity: 1 });

    this.bg.update(this.text, style);
    canvas.requestRenderAll();
  }

  private disposeObjects() {
    if (this.text) this.canvas.remove(this.text);
    if (this.cursor) this.canvas.remove(this.cursor);
    this.text = null;
    this.cursor = null;
  }

  dispose() {
    this.disposeObjects();
    this.bg?.dispose();
    this.currentLineId = null;
  }
}
