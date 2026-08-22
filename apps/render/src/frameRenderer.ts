import { setEnv } from "fabric";
import { getEnv as getNodeEnv, StaticCanvas, type Canvas } from "fabric/node";

// Configure Fabric with Node/JSDOM environment for headless rendering
setEnv(getNodeEnv());

import { SubtitleRenderer, CANVAS_W, CANVAS_H } from "@captionly/engine";
import type {
  SubtitleLine,
  SubtitleStyle,
  SubtitlePosition,
  AnimationConfig,
} from "@captionly/engine";

function canvasToBuffer(fabricCanvas: StaticCanvas): Buffer {
  return fabricCanvas.getNodeCanvas().toBuffer("image/png");
}

export async function* renderFrames(
  lines: SubtitleLine[],
  style: SubtitleStyle,
  position: SubtitlePosition,
  animation: AnimationConfig,
  fps: number,
  duration: number,
): AsyncGenerator<Buffer> {
  const canvas = new StaticCanvas(undefined, {
    width: CANVAS_W,
    height: CANVAS_H,
    renderOnAddRemove: false,
  });

  const renderer = new SubtitleRenderer(
    canvas as unknown as Canvas,
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
