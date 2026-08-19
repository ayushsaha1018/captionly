import { fabric } from "fabric";

// fabric 5 bootstraps a jsdom document at fabric.document. Expose it as the
// global `document` so animation helpers (e.g. measureWidth in helpers.ts)
// can call document.createElement("canvas") in a Node/Bun environment.
if (typeof document === "undefined") {
  (globalThis as Record<string, unknown>).document = (
    fabric as unknown as { document: unknown }
  ).document;
}

import { SubtitleRenderer, CANVAS_W, CANVAS_H } from "engine";
import type {
  SubtitleLine,
  SubtitleStyle,
  SubtitlePosition,
  AnimationConfig,
} from "engine";

// fabric 5 node mode: jsdom-backed canvas; get raw node-canvas via impl wrapper
function canvasToBuffer(fabricCanvas: fabric.StaticCanvas): Buffer {
  const impl = (
    fabric as unknown as {
      jsdomImplForWrapper: (el: unknown) => {
        _canvas: { toBuffer(fmt: string): Buffer };
      };
    }
  ).jsdomImplForWrapper(fabricCanvas.lowerCanvasEl);
  return impl._canvas.toBuffer("image/png");
}

export async function* renderFrames(
  lines: SubtitleLine[],
  style: SubtitleStyle,
  position: SubtitlePosition,
  animation: AnimationConfig,
  fps: number,
  duration: number,
): AsyncGenerator<Buffer> {
  const canvas = new fabric.StaticCanvas(null, {
    width: CANVAS_W,
    height: CANVAS_H,
    renderOnAddRemove: false,
  });

  const renderer = new SubtitleRenderer(
    canvas,
    lines,
    style,
    position,
    animation,
  );
  const total = Math.ceil(duration * fps);

  for (let i = 0; i < total; i++) {
    renderer.render(i / fps);
    canvas.renderAll();
    yield canvasToBuffer(canvas);
  }

  renderer.dispose();
  canvas.dispose();
}
