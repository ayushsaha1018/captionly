import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { probeVideo } from "./probe";
import { renderFrames } from "./frameRenderer";
import { encodeVideo } from "./encode";
import { CANVAS_W, CANVAS_H } from "@captionly/engine";
import type {
  SubtitleLine,
  SubtitleStyle,
  SubtitlePosition,
  AnimationConfig,
} from "@captionly/engine";

type SubtitleJSON = {
  lines: SubtitleLine[];
  style: SubtitleStyle;
  position: SubtitlePosition;
  animation: AnimationConfig;
};

const ALLOWED_ORIGIN = process.env.RENDER_ALLOW_ORIGIN ?? "*";

function jsonError(message: string, status: number): Response {
  return Response.json(
    { error: message },
    { status, headers: { "Access-Control-Allow-Origin": ALLOWED_ORIGIN } },
  );
}

async function handleRender(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID().slice(0, 8);
  const log = (msg: string) => console.log(`[${requestId}] ${msg}`);

  let workDir: string | null = null;
  try {
    const form = await req.formData();
    const video = form.get("video");
    const subtitlesRaw = form.get("subtitles");

    if (!(video instanceof Blob) || typeof subtitlesRaw !== "string") {
      return jsonError(
        "Request must include a 'video' file and a 'subtitles' JSON string",
        400,
      );
    }

    const { lines, style, position, animation } = JSON.parse(
      subtitlesRaw,
    ) as SubtitleJSON;

    workDir = await mkdtemp(join(tmpdir(), "captionly-render-"));
    const inputPath = join(workDir, "input.mp4");
    const outputPath = join(workDir, "output.mp4");
    await Bun.write(inputPath, video);

    log("Probing video…");
    const { fps, duration, width, height } = await probeVideo(inputPath);
    const totalFrames = Math.ceil(duration * fps);
    log(
      `${width}×${height} @ ${fps.toFixed(2)} fps — ${duration.toFixed(2)}s — ${totalFrames} frames`,
    );

    log("Rendering subtitle overlay + encoding…");
    const frames = renderFrames(lines, style, position, animation, fps, duration);
    await encodeVideo(
      inputPath,
      outputPath,
      fps,
      width,
      height,
      frames,
      totalFrames,
      CANVAS_W,
      CANVAS_H,
      (frame, total) => {
        if (frame === total || frame % 30 === 0) log(`Rendering frame ${frame} / ${total}`);
      },
    );

    const outputBuffer = await Bun.file(outputPath).arrayBuffer();
    log("Done");

    return new Response(outputBuffer, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Render failed";
    log(`Error: ${message}`);
    return jsonError(message, 500);
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true });
  }
}

export function createRenderServer(port = 4000) {
  return Bun.serve({
    port,
    routes: {
      "/render": {
        POST: handleRender,
      },
    },
  });
}

if (import.meta.main) {
  const server = createRenderServer(Number(process.env.PORT) || 4000);
  console.log(`Render server listening on http://localhost:${server.port}`);
}
