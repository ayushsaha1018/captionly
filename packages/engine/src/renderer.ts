import { Canvas } from "fabric";
import type {
  SubtitleLine,
  SubtitleStyle,
  SubtitlePosition,
  AnimationConfig,
} from "./types";
import type { AnimationStrategy } from "./animations/types";
import { createStrategy } from "./animations/registry";

export const CANVAS_W = 1920;
export const CANVAS_H = 1080;

/**
 * SubtitleRenderer
 *
 * Thin orchestrator. Owns the fabric canvas + state, delegates rendering
 * to a swappable AnimationStrategy. Pure function of (currentTime, state)
 * for headless / server-side reuse.
 */
export class SubtitleRenderer {
  private canvas: Canvas;
  private lines: SubtitleLine[] = [];
  private style: SubtitleStyle;
  private position: SubtitlePosition;
  private animation: AnimationConfig;
  private strategy: AnimationStrategy;

  constructor(
    canvas: Canvas,
    lines: SubtitleLine[],
    style: SubtitleStyle,
    position: SubtitlePosition,
    animation: AnimationConfig,
  ) {
    this.canvas = canvas;
    this.lines = lines;
    this.style = style;
    this.position = position;
    this.animation = animation;
    this.strategy = createStrategy(animation.type);
    this.strategy.mount(canvas);
  }

  setStyle(style: SubtitleStyle) {
    this.style = style;
    // Rebuild so font/stroke updates propagate
    this.strategy.dispose();
    this.strategy = createStrategy(this.animation.type);
    this.strategy.mount(this.canvas);
  }

  setAnimation(animation: AnimationConfig) {
    const typeChanged = animation.type !== this.animation.type;
    this.animation = animation;
    if (typeChanged) {
      this.strategy.dispose();
      this.strategy = createStrategy(animation.type);
      this.strategy.mount(this.canvas);
    }
  }

  setLines(lines: SubtitleLine[]) {
    this.lines = lines;
    this.strategy.dispose();
    this.strategy = createStrategy(this.animation.type);
    this.strategy.mount(this.canvas);
  }

  setPosition(p: SubtitlePosition) {
    this.position = p;
  }

  getPosition(): SubtitlePosition {
    return { ...this.position };
  }

  render(currentTime: number) {
    this.strategy.update({
      canvas: this.canvas,
      lines: this.lines,
      style: this.style,
      position: this.position,
      currentTime,
      options: this.animation.options,
      onPositionChange: (p) => {
        this.position = p;
      },
    });
  }

  dispose() {
    this.strategy.dispose();
  }
}
