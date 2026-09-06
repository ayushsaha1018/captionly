import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type {
  SubtitleLine,
  SubtitleStyle,
  SubtitlePosition,
  AnimationConfig,
} from "@captionly/engine";
import { probeVideo } from "./probe";

type SubtitleJSON = {
  lines: SubtitleLine[];
  style: SubtitleStyle;
  position: SubtitlePosition;
  animation: AnimationConfig;
};

const ALLOWED_ORIGIN = process.env.RENDER_ALLOW_ORIGIN ?? "*";
let bundlePromise: Promise<string> | null = null;
const activeVideos = new Map<string, string>();

function getBundle(): Promise<string> {
  if (!bundlePromise) {
    bundlePromise = bundle({
      entryPoint: join(import.meta.dir, "remotionRoot.tsx"),
    });
  }
  return bundlePromise;
}

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

    activeVideos.set(requestId, inputPath);
    const origin = new URL(req.url).origin;
    const videoUrl = `${origin}/video/${requestId}.mp4`;

    const formWidth = form.get("width") ? Number(form.get("width")) : null;
    const formHeight = form.get("height") ? Number(form.get("height")) : null;
    const formDuration = form.get("durationSec") ? Number(form.get("durationSec")) : null;
    const formFps = form.get("fps") ? Number(form.get("fps")) : null;

    const videoInfo = await probeVideo(inputPath).catch((err) => {
      log(`Probe warning: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    });

    const fps = formFps || (videoInfo?.fps ? Math.round(videoInfo.fps) : 30);
    const durationSec = formDuration ?? videoInfo?.duration ?? 15;
    const durationInFrames = Math.max(1, Math.ceil(durationSec * fps));
    const width = formWidth ?? videoInfo?.width ?? 1920;
    const height = formHeight ?? videoInfo?.height ?? 1080;

    log("Bundling / resolving composition…");
    const bundleLocation = await getBundle();

    const inputProps = {
      videoSrc: videoUrl,
      subtitles: {
        lines,
        style,
        position,
        animation,
      },
      width,
      height,
      durationInFrames,
      fps,
    };

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: "MainComposition",
      inputProps,
    });

    log(`Rendering Remotion video (${durationInFrames} frames @ ${fps} fps, ${width}x${height})…`);
    await renderMedia({
      composition: {
        ...composition,
        durationInFrames,
        fps,
        width,
        height,
      },
      serveUrl: bundleLocation,
      codec: "h264",
      crf: 18,
      pixelFormat: "yuv420p",
      outputLocation: outputPath,
      inputProps,
      licenseKey: "free-license",
      onProgress: ({ progress, renderedFrames }) => {
        log(`Rendering progress: ${Math.round(progress * 100)}% (${renderedFrames} frames)`);
      },
    });

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
    activeVideos.delete(requestId);
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
    fetch(req) {
      if (req.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*",
          },
        });
      }

      const url = new URL(req.url);
      if (url.pathname.startsWith("/video/") && (req.method === "GET" || req.method === "HEAD")) {
        const id = url.pathname.replace(/^\/video\//, "").replace(/\.mp4$/, "");
        const filePath = activeVideos.get(id);
        if (filePath && Bun.file(filePath).size > 0) {
          const file = Bun.file(filePath);
          const range = req.headers.get("range");

          if (range) {
            const matches = range.match(/bytes=(\d+)-(\d*)/);
            if (matches) {
              const start = parseInt(matches[1]!, 10);
              const end = matches[2] ? parseInt(matches[2], 10) : file.size - 1;
              const chunkSize = end - start + 1;
              return new Response(file.slice(start, end + 1), {
                status: 206,
                headers: {
                  "Content-Range": `bytes ${start}-${end}/${file.size}`,
                  "Accept-Ranges": "bytes",
                  "Content-Length": String(chunkSize),
                  "Content-Type": "video/mp4",
                  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
                },
              });
            }
          }

          return new Response(file, {
            headers: {
              "Content-Type": "video/mp4",
              "Accept-Ranges": "bytes",
              "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
              "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
              "Access-Control-Expose-Headers": "Content-Length, Content-Range",
            },
          });
        }
        return new Response("Not found", { status: 404 });
      }

      return new Response("Not found", { status: 404 });
    },
  });
}

if (import.meta.main) {
  const server = createRenderServer(Number(process.env.PORT) || 4000);
  console.log(`Render server listening on http://localhost:${server.port}`);
}
