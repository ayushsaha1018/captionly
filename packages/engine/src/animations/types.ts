import type { Canvas } from "fabric";
import type {
  SubtitleLine,
  SubtitleStyle,
  SubtitlePosition,
  AnimationConfig,
} from "../types";

export type UpdateCtx = {
  canvas: Canvas;
  lines: SubtitleLine[];
  style: SubtitleStyle;
  position: SubtitlePosition;
  currentTime: number;
  options: AnimationConfig["options"];
  onPositionChange: (p: SubtitlePosition) => void;
};

/**
 * Pure animation strategy. update() must be deterministic from
 * (currentTime, lines, style, options) so the same renderer can be
 * reused for headless server-side frame export.
 */
export interface AnimationStrategy {
  mount(canvas: Canvas): void;
  update(ctx: UpdateCtx): void;
  dispose(): void;
}
