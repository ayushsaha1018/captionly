import { fabric } from "fabric";
import type { AnimationStrategy, UpdateCtx } from "./types";
import type { RollUpOptions, SubtitleLine, SubtitleStyle } from "../types";
import { clamp, easeOutCubic } from "../animation";
import { BackgroundLayer, wrapTextToLines } from "./helpers";

const SOFT_DURATION = 0.4;

type LineObj = {
  line: SubtitleLine;
  text: fabric.Text;
  visualLines: number;
};

/**
 * Roll-Up — multi-line buffer scrolling up from the bottom anchor.
 * Each logical line may wrap into N visual lines; the stack offset for
 * an older line equals the cumulative visual-line height of all newer
 * lines below it. Line spacing is added between logical lines only.
 */
export class RollUpStrategy implements AnimationStrategy {
  private canvas!: fabric.Canvas;
  private objs = new Map<string, LineObj>();
  private bgs = new Map<string, BackgroundLayer>();

  mount(canvas: fabric.Canvas) {
    this.canvas = canvas;
  }

  private buildText(
    line: SubtitleLine,
    style: SubtitleStyle,
  ): {
    text: fabric.Text;
    visualLines: number;
  } {
    const raw = line.words.map((w) => w.text).join(" ");
    const wrapped = wrapTextToLines(
      raw,
      style.boxWidth,
      style.fontSize,
      style.fontFamily,
      style.fontWeight,
    );
    const visualLines = Math.max(1, wrapped.length);
    const text = new fabric.Text(wrapped.join("\n"), {
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      fontSize: style.fontSize,
      fill: style.color,
      stroke: style.stroke,
      strokeWidth: style.strokeWidth,
      paintFirst: "stroke",
      strokeLineJoin: "round",
      originX: "center",
      // Each logical line is anchored at its BOTTOM so multi-line lines
      // grow upward from their slot, keeping the slot bottom edge stable.
      originY: "bottom",
      textAlign: "center",
      selectable: false,
      evented: false,
      objectCaching: false,
      shadow: new fabric.Shadow({
        color: "rgba(0,0,0,0.6)",
        blur: 8,
        offsetX: 0,
        offsetY: 4,
      }),
    });
    return { text, visualLines };
  }

  private getOrCreate(line: SubtitleLine, style: SubtitleStyle): LineObj {
    let o = this.objs.get(line.id);
    if (o) return o;
    const built = this.buildText(line, style);
    o = { line, text: built.text, visualLines: built.visualLines };
    this.objs.set(line.id, o);
    this.bgs.set(line.id, new BackgroundLayer(this.canvas));
    this.canvas.add(built.text);
    return o;
  }

  update(uctx: UpdateCtx) {
    const { canvas, lines, style, position, currentTime } = uctx;
    const opts = uctx.options as RollUpOptions;
    const visualLineHeight = style.fontSize * 1.16;
    const blockGap = opts.lineSpacing;

    const started = lines.filter((l) => currentTime >= l.start);
    const visible = started.slice(-Math.max(opts.lineLimit + 1, 1));

    // Hide everything not visible
    this.objs.forEach((o, id) => {
      if (!visible.find((l) => l.id === id)) {
        o.text.set({ opacity: 0 });
        const b = this.bgs.get(id);
        b?.update(null, style);
      }
    });

    if (!visible.length) {
      canvas.requestRenderAll();
      return;
    }

    // Newest line drives the soft transition
    const newest = visible[visible.length - 1];
    const since = currentTime - newest.start;
    const scrollT =
      opts.transition === "soft"
        ? easeOutCubic(clamp(since / SOFT_DURATION, 0, 1))
        : 1;

    // Compute slot heights using each line's visualLines count (bottom up).
    // visible[length-1] is newest at slot 0 (bottom).
    const slotsBottomUp = [...visible].reverse(); // index 0 = newest

    // Pre-compute cumulative bottom offset of each slot's bottom edge,
    // measured upward from anchor (position.y).
    const heights = slotsBottomUp.map((l) => {
      const o = this.getOrCreate(l, style);
      return o.visualLines * visualLineHeight;
    });

    // Bottom-edge y of slot i (from bottom anchor).
    // slot 0 bottom = position.y (anchor=bottom)
    // slot 1 bottom = slot 0 bottom - heights[0] - blockGap
    const slotBottomY: number[] = [];
    let acc = position.y;
    for (let i = 0; i < slotsBottomUp.length; i++) {
      slotBottomY.push(acc);
      acc -= heights[i] + blockGap;
    }

    // Previous frame slot positions (for soft scroll lerp): each line was
    // one slot lower (slot i was at slot i-1's previous bottom). To compute
    // that we shift heights/blockGap accordingly.
    // Simplification: previous slot bottom for slot i = slotBottomY[i-1] (which
    // belonged to the now-newer line). For slot 0 (the new line) it animates
    // from position.y + heights[0] (just below the visible band) up to position.y.
    const prevSlotBottomY: number[] = slotsBottomUp.map((_, i) => {
      if (i === 0) return position.y + heights[0]; // entering from below
      return slotBottomY[i - 1];
    });

    // Hide / fade behavior for over-limit oldest line
    const overLimit = visible.length > opts.lineLimit;

    slotsBottomUp.forEach((l, i) => {
      const o = this.getOrCreate(l, style);
      const targetBottom = slotBottomY[i];
      const fromBottom =
        opts.transition === "soft" ? prevSlotBottomY[i] : targetBottom;
      const interp = fromBottom + (targetBottom - fromBottom) * scrollT;

      // Active highlight: only the newest line uses activeColor
      o.text.set({
        left: position.x,
        top: interp,
        originY: "bottom",
        fill: i === 0 ? style.activeColor : style.color,
      });

      let opacity = 1;
      if (i === 0 && opts.transition === "soft") {
        opacity = scrollT;
      }
      // Oldest beyond limit fades out / hides
      if (overLimit && i === slotsBottomUp.length - 1) {
        opacity = opts.transition === "soft" ? 1 - scrollT : 0;
      }
      o.text.set({ opacity });
      o.text.setCoords();

      const bg = this.bgs.get(l.id);
      bg?.update(o.text, style, opacity);
    });

    canvas.requestRenderAll();
  }

  dispose() {
    this.objs.forEach((o) => this.canvas.remove(o.text));
    this.objs.clear();
    this.bgs.forEach((b) => b.dispose());
    this.bgs.clear();
  }
}
