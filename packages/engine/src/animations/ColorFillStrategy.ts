import { Canvas, FabricText, Group, Shadow } from "fabric";
import type { AnimationStrategy, UpdateCtx } from "./types";
import type {
  SubtitleLine,
  SubtitleStyle,
  ColorFillOptions,
  Word,
} from "../types";
import { clamp } from "../animation";
import { BackgroundLayer, measureWidth } from "./helpers";

const SPACE_PX_RATIO = 0.32; // space width as fraction of fontSize

type LetterObj = {
  word: Word;
  charIdxInWord: number;
  charsInWord: number;
  text: FabricText;
};

type LineCache = {
  group: Group | null;
  letters: LetterObj[];
};

/**
 * Color Fill — words highlight as they are spoken.
 * Per-letter rendering supports gradient transition.
 * Wraps to new visual lines when total width exceeds style.boxWidth.
 */
export class ColorFillStrategy implements AnimationStrategy {
  private canvas!: Canvas;
  private cache = new Map<string, LineCache>();
  private currentLineId: string | null = null;
  private bg!: BackgroundLayer;

  mount(canvas: Canvas) {
    this.canvas = canvas;
    this.bg = new BackgroundLayer(canvas);
  }

  private buildLine(line: SubtitleLine, style: SubtitleStyle): LineCache {
    const spaceW = style.fontSize * SPACE_PX_RATIO;

    // Measure each word width
    const wordMetrics = line.words.map((w) => ({
      word: w,
      width: measureWidth(
        w.text,
        style.fontSize,
        style.fontFamily,
        style.fontWeight,
      ),
    }));

    // Greedy line break by boxWidth
    const visualLines: { items: typeof wordMetrics; width: number }[] = [];
    let cur: typeof wordMetrics = [];
    let curW = 0;
    for (const wm of wordMetrics) {
      const addW = (cur.length ? spaceW : 0) + wm.width;
      if (cur.length && curW + addW > style.boxWidth) {
        visualLines.push({ items: cur, width: curW });
        cur = [wm];
        curW = wm.width;
      } else {
        cur.push(wm);
        curW += addW;
      }
    }
    if (cur.length) visualLines.push({ items: cur, width: curW });

    const lineHeight = style.fontSize * 1.15;
    const totalH = visualLines.length * lineHeight;

    // Compute y offset based on anchor (anchor inside group origin = center)
    const anchor = style.boxAnchor;
    const yStart =
      anchor === "top" ? 0 : anchor === "bottom" ? -totalH : -totalH / 2;

    const letters: LetterObj[] = [];
    const allFabric: FabricText[] = [];

    visualLines.forEach((vl, vlIdx) => {
      const yCenter = yStart + vlIdx * lineHeight + lineHeight / 2;
      let xCursor = -vl.width / 2;
      vl.items.forEach((wm, wIdx) => {
        const chars = Array.from(wm.word.text);
        chars.forEach((ch, ci) => {
          const t = new FabricText(ch, {
            fontFamily: style.fontFamily,
            fontWeight: style.fontWeight,
            fontSize: style.fontSize,
            fill: style.color,
            stroke: style.stroke,
            strokeWidth: style.strokeWidth,
            paintFirst: "stroke",
            strokeLineJoin: "round",
            originX: "left",
            originY: "center",
            left: xCursor,
            top: yCenter,
            selectable: false,
            evented: false,
            objectCaching: true,
            shadow: new Shadow({
              color: "rgba(0,0,0,0.6)",
              blur: 8,
              offsetX: 0,
              offsetY: 4,
            }),
          });
          xCursor += t.width ?? 0;
          letters.push({
            word: wm.word,
            charIdxInWord: ci,
            charsInWord: chars.length,
            text: t,
          });
          allFabric.push(t);
        });
        if (wIdx < vl.items.length - 1) xCursor += spaceW;
      });
    });

    const group = new Group(allFabric, {
      originX: "center",
      originY: "center",
      selectable: true,
      hasControls: false,
      hasBorders: true,
      borderColor: "rgba(255,255,255,0.4)",
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
      subTargetCheck: false,
      objectCaching: false,
    });

    return { group, letters };
  }

  private anchorYOffset(style: SubtitleStyle, group: Group): number {
    // group origin is center; we positioned children so that anchor sits at y=0.
    // So setting group.top = position.y aligns the anchor point with position.y
    // automatically because we used yStart relative to anchor.
    const h = group.height ?? 0;
    if (style.boxAnchor === "top") return h / 2;
    if (style.boxAnchor === "bottom") return -h / 2;
    return 0;
  }

  update(ctx: UpdateCtx) {
    const { canvas, lines, style, position, currentTime } = ctx;
    const opts = ctx.options as ColorFillOptions;

    const line =
      lines.find((l) => currentTime >= l.start && currentTime <= l.end) ?? null;

    if (!line) {
      this.cache.forEach((c) => c.group?.set({ opacity: 0 }));
      this.bg.update(null, style);
      canvas.requestRenderAll();
      return;
    }

    if (this.currentLineId && this.currentLineId !== line.id) {
      const prev = this.cache.get(this.currentLineId);
      prev?.group?.set({ opacity: 0 });
    }

    let cache = this.cache.get(line.id);
    if (!cache) {
      cache = this.buildLine(line, style);
      this.cache.set(line.id, cache);
      if (cache.group) {
        cache.group.on("moving", () => {
          ctx.onPositionChange({
            x: cache!.group!.left ?? 0,
            y: cache!.group!.top ?? 0,
          });
        });
        canvas.add(cache.group);
      }
    }
    this.currentLineId = line.id;

    if (cache.group) {
      const yOff = this.anchorYOffset(style, cache.group);
      cache.group.set({
        left: position.x,
        top: position.y + yOff,
        opacity: 1,
      });
      cache.group.setCoords();
    }

    // Per-letter color
    cache.letters.forEach((l) => {
      const w = l.word;
      const isPast = currentTime >= w.end;
      const isFuture = currentTime < w.start;
      const dur = Math.max(0.001, w.end - w.start);
      const progress = clamp((currentTime - w.start) / dur, 0, 1);

      let fill: string;
      if (isFuture) fill = style.color;
      else if (isPast) fill = style.activeColor;
      else if (opts.transition === "hardCut") fill = style.activeColor;
      else {
        const letterProgress = (l.charIdxInWord + 1) / l.charsInWord;
        fill = letterProgress <= progress ? style.activeColor : style.color;
      }
      if (l.text.fill !== fill) l.text.set({ fill });
    });

    this.bg.update(cache.group ?? null, style);
    canvas.requestRenderAll();
  }

  dispose() {
    this.cache.forEach((c) => {
      if (c.group) this.canvas.remove(c.group);
    });
    this.cache.clear();
    this.bg?.dispose();
    this.currentLineId = null;
  }
}
