import "./worker-polyfill";
import { fabric } from "fabric";
import {
  SubtitleRenderer,
  CANVAS_W,
  CANVAS_H,
  type SubtitleLine,
  type SubtitleStyle,
  type SubtitlePosition,
  type AnimationConfig,
} from "@captionly/engine";

function makeFabricCompatible(canvas: OffscreenCanvas): void {
  const c = canvas as unknown as Record<string, unknown>;
  if (!c.style) {
    c.style = { width: `${canvas.width}px`, height: `${canvas.height}px` };
  }
  if (!c.classList) {
    c.classList = {
      add: () => {},
      remove: () => {},
      contains: () => false,
    };
  }
  if (!c.className) {
    c.className = "";
  }
  if (!c.setAttribute) {
    c.setAttribute = () => {};
  }
  if (!c.removeAttribute) {
    c.removeAttribute = () => {};
  }
  if (!c.getBoundingClientRect) {
    c.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: canvas.width,
      height: canvas.height,
    });
  }
}

export interface CompositorOptions {
  width: number;
  height: number;
  lines: SubtitleLine[];
  style: SubtitleStyle;
  position: SubtitlePosition;
  animation: AnimationConfig;
}

export class VideoFrameCompositor {
  private width: number;
  private height: number;
  private compositeCanvas: OffscreenCanvas;
  private compositeCtx: OffscreenCanvasRenderingContext2D;
  private subtitleCanvas: OffscreenCanvas;
  private fabricCanvas: fabric.StaticCanvas;
  private subtitleRenderer: SubtitleRenderer;

  constructor(options: CompositorOptions) {
    this.width = options.width;
    this.height = options.height;

    // Canvas for final output (video frame + subtitle overlay)
    this.compositeCanvas = new OffscreenCanvas(this.width, this.height);
    makeFabricCompatible(this.compositeCanvas);

    const ctx = this.compositeCanvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });
    if (!ctx) {
      throw new Error("Failed to get 2D context for composite OffscreenCanvas");
    }
    this.compositeCtx = ctx;

    // Dedicated 1920x1080 canvas for Fabric subtitle rendering
    this.subtitleCanvas = new OffscreenCanvas(CANVAS_W, CANVAS_H);
    makeFabricCompatible(this.subtitleCanvas);

    // Initialize Fabric StaticCanvas on the subtitle offscreen canvas
    this.fabricCanvas = new fabric.StaticCanvas(
      this.subtitleCanvas as unknown as HTMLCanvasElement,
      {
        width: CANVAS_W,
        height: CANVAS_H,
        renderOnAddRemove: false,
        backgroundColor: "rgba(0,0,0,0)",
        enableRetinaScaling: false,
      },
    );

    this.subtitleRenderer = new SubtitleRenderer(
      this.fabricCanvas as unknown as fabric.Canvas,
      options.lines,
      options.style,
      options.position,
      options.animation,
    );
  }

  /**
   * Composites a decoded VideoFrame with subtitle overlay at the given timestamp.
   * Returns a newly created VideoFrame ready for the VideoEncoder.
   */
  public composite(videoFrame: VideoFrame): VideoFrame {
    const timestamp = videoFrame.timestamp;
    const duration = videoFrame.duration ?? 0;
    const timeInSec = timestamp / 1_000_000;

    // 1. Draw source video frame
    this.compositeCtx.drawImage(
      videoFrame as unknown as CanvasImageSource,
      0,
      0,
      this.width,
      this.height,
    );

    // 2. Render subtitles at current timestamp
    this.subtitleRenderer.render(timeInSec);
    this.fabricCanvas.renderAll();

    // 3. Overlay subtitle canvas on top of video frame
    this.compositeCtx.drawImage(
      this.subtitleCanvas as unknown as CanvasImageSource,
      0,
      0,
      this.width,
      this.height,
    );

    // 4. Create and return output VideoFrame
    return new VideoFrame(this.compositeCanvas, {
      timestamp,
      duration,
      alpha: "discard",
    });
  }

  public dispose(): void {
    try {
      this.subtitleRenderer.dispose();
      this.fabricCanvas.dispose();
    } catch (err) {
      console.warn("Error disposing compositor resources:", err);
    }
  }
}
