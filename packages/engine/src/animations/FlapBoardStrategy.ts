import { fabric } from "fabric";
import type { AnimationStrategy, UpdateCtx } from "./types";
import type { FlapBoardOptions, SubtitleLine } from "../types";
import { clamp } from "../animation";
import { BackgroundLayer, wrapTextToLines } from "./helpers";

const FLAP_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Flap Board — split-flap display: each character cycles through random
 * letters before settling on its final value, staggered left-to-right.
 */
export class FlapBoardStrategy implements AnimationStrategy {
  private canvas!: fabric.Canvas;
  private text: fabric.Text | null = null;
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
    const opts = uctx.options as FlapBoardOptions;

    const line =
      lines.find((l) => currentTime >= l.start && currentTime <= l.end) ?? null;
    if (!line) {
      this.text?.set({ opacity: 0 });
      this.bg.update(null, style);
      canvas.requestRenderAll();
      return;
    }

    const full = this.fullText(line);
    const wrapped = wrapTextToLines(
      full,
      style.boxWidth,
      style.fontSize,
      style.fontFamily,
      style.fontWeight,
    );

    if (this.currentLineId !== line.id || !this.text) {
      this.disposeObjects();
      this.text = new fabric.Text("", {
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

    // Per-char stagger: each char starts cycling at idx * (flapDuration/N).
    const elapsed = currentTime - line.start;
    const totalChars = full.length;
    const stagger = Math.max(0.02, opts.flapDuration / Math.max(1, totalChars));
    const lineDuration = Math.max(0.001, line.end - line.start);
    // settle progress per char position
    const out: string[] = [];
    let charIdx = 0;
    for (const wline of wrapped) {
      const lineOut: string[] = [];
      for (const ch of wline) {
        if (ch === " ") {
          lineOut.push(" ");
          charIdx++;
          continue;
        }
        const startT = charIdx * stagger;
        const localT = elapsed - startT;
        if (localT < 0) {
          lineOut.push(" ");
        } else if (localT < opts.flapDuration) {
          // cycle through random chars deterministically
          const phase = Math.floor(
            (localT / opts.flapDuration) * opts.cyclesPerChar,
          );
          const seed = (charIdx * 131 + phase * 17) % FLAP_CHARS.length;
          lineOut.push(FLAP_CHARS[seed]);
        } else {
          lineOut.push(ch);
        }
        charIdx++;
      }
      out.push(lineOut.join(""));
    }

    this.text.set({
      text: out.join("\n"),
      left: position.x,
      top: position.y,
      originY: style.boxAnchor,
      opacity: clamp(elapsed / 0.15, 0, 1),
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
