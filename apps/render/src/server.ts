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
import { createJob, getJob, getNextQueuedJob, getStaleJobs, deleteJob, updateJob, type Job } from "./db";
import { getBrowser, closeBrowser, detectConcurrency } from "./browserPool";

type SubtitleJSON = {
  lines: SubtitleLine[];
  style: SubtitleStyle;
  position: SubtitlePosition;
  animation: AnimationConfig;
};

const ALLOWED_ORIGIN = process.env.RENDER_ALLOW_ORIGIN ?? "*";
const JOB_TTL_MS = 60 * 60 * 1000; // keep finished jobs downloadable for 1h, then sweep
let bundlePromise: Promise<string> | null = null;
// jobId -> input video path, only populated while that job is actively rendering
// (Remotion's headless browser fetches the source video over HTTP from /video/:id.mp4)
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

async function handleSubmitRender(req: Request): Promise<Response> {
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

    workDir = await mkdtemp(join(tmpdir(), "captionly-render-"));
    await Bun.write(join(workDir, "input.mp4"), video);
    await Bun.write(join(workDir, "subtitles.json"), subtitlesRaw);

    const jobId = crypto.randomUUID();
    createJob({
      id: jobId,
      workDir,
      origin: new URL(req.url).origin,
      width: form.get("width") ? Number(form.get("width")) : null,
      height: form.get("height") ? Number(form.get("height")) : null,
      durationSec: form.get("durationSec") ? Number(form.get("durationSec")) : null,
      fps: form.get("fps") ? Number(form.get("fps")) : null,
    });

    runWorker();

    return Response.json(
      { jobId },
      { status: 202, headers: { "Access-Control-Allow-Origin": ALLOWED_ORIGIN } },
    );
  } catch (err) {
    if (workDir) await rm(workDir, { recursive: true, force: true });
    const message = err instanceof Error ? err.message : "Failed to queue render";
    return jsonError(message, 500);
  }
}

function handleJobStatus(req: Request): Response {
  const id = (req as Request & { params: { id: string } }).params.id;
  const job = getJob(id);
  if (!job) return jsonError("Job not found", 404);
  return Response.json(
    {
      status: job.status,
      progress: job.progress,
      renderedFrames: job.rendered_frames,
      totalFrames: job.total_frames,
      error: job.error,
    },
    { headers: { "Access-Control-Allow-Origin": ALLOWED_ORIGIN } },
  );
}

function handleJobOutput(req: Request): Response {
  const id = (req as Request & { params: { id: string } }).params.id;
  const job = getJob(id);
  if (!job) return jsonError("Job not found", 404);
  if (job.status === "error") return jsonError(job.error ?? "Render failed", 500);
  if (job.status !== "complete") return jsonError(`Job is still ${job.status}`, 409);

  return new Response(Bun.file(join(job.work_dir, "output.mp4")), {
    headers: {
      "Content-Type": "video/mp4",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    },
  });
}

// Single serial worker: renderMedia is CPU-bound (headless Chromium + software
// x264), so running more than one at a time would only slow each other down.
// ponytail: one worker, one queue row polled at a time — bump to a small pool
// with per-job concurrency accounting if a multi-core render box is idle.
let workerRunning = false;

function runWorker(): void {
  if (workerRunning) return;
  workerRunning = true;
  (async () => {
    try {
      let job = getNextQueuedJob();
      while (job) {
        await processJob(job);
        job = getNextQueuedJob();
      }
    } finally {
      workerRunning = false;
    }
  })();
}

async function processJob(job: Job): Promise<void> {
  const log = (msg: string) => console.log(`[${job.id}] ${msg}`);
  updateJob(job.id, { status: "processing" });

  const inputPath = join(job.work_dir, "input.mp4");
  const outputPath = join(job.work_dir, "output.mp4");

  try {
    const { lines, style, position, animation } = JSON.parse(
      await Bun.file(join(job.work_dir, "subtitles.json")).text(),
    ) as SubtitleJSON;

    activeVideos.set(job.id, inputPath);
    const videoUrl = `${job.origin}/video/${job.id}.mp4`;

    const videoInfo = await probeVideo(inputPath).catch((err) => {
      log(`Probe warning: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    });

    const fps = job.fps || (videoInfo?.fps ? Math.round(videoInfo.fps) : 30);
    const durationSec = job.duration_sec ?? videoInfo?.duration ?? 15;
    const durationInFrames = Math.max(1, Math.ceil(durationSec * fps));
    const width = job.width ?? videoInfo?.width ?? 1920;
    const height = job.height ?? videoInfo?.height ?? 1080;

    updateJob(job.id, { total_frames: durationInFrames });

    log("Bundling / resolving composition…");
    const bundleLocation = await getBundle();

    const inputProps = {
      videoSrc: videoUrl,
      subtitles: { lines, style, position, animation },
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

    log(`Rendering (${durationInFrames} frames @ ${fps}fps, ${width}x${height})…`);
    const renderStart = performance.now();
    await renderMedia({
      composition: { ...composition, durationInFrames, fps, width, height },
      serveUrl: bundleLocation,
      codec: "h264",
      // crf: 18,
      // "faster" trades encode speed for compression efficiency at the same
      // CRF — same visual quality, slightly larger file, quicker encode.
      x264Preset: "faster",
      pixelFormat: "yuv420p",
      outputLocation: outputPath,
      inputProps,
      licenseKey: "free-license",
      puppeteerInstance: await getBrowser(),
      hardwareAcceleration: "if-possible",
      onProgress: ({ progress, renderedFrames }) => {
        updateJob(job.id, { progress, rendered_frames: renderedFrames });
      },
    });

    const renderSec = (performance.now() - renderStart) / 1000;
    updateJob(job.id, { status: "complete", progress: 1 });
    log(
      `Done in ${renderSec.toFixed(1)}s for a ${durationSec.toFixed(1)}s video ` +
        `(${(renderSec / durationSec).toFixed(2)}x realtime)`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Render failed";
    log(`Error: ${message}`);
    updateJob(job.id, { status: "error", error: message });
  } finally {
    activeVideos.delete(job.id);
  }
}

// Finished jobs keep their work_dir on disk so /render/:id/output can serve it;
// sweep them out after JOB_TTL_MS so a client that never downloads doesn't leak disk.
function sweepStaleJobs(): void {
  for (const job of getStaleJobs(JOB_TTL_MS)) {
    rm(job.work_dir, { recursive: true, force: true }).catch(() => {});
    deleteJob(job.id);
  }
}

export function createRenderServer(port = 4000) {
  setInterval(sweepStaleJobs, 10 * 60 * 1000);

  return Bun.serve({
    port,
    maxRequestBodySize: 1024 * 1024 * 1024, // 1GB, default 128MB is too small for source video uploads
    routes: {
      "/render": {
        POST: handleSubmitRender,
      },
      "/render/:id": {
        GET: handleJobStatus,
      },
      "/render/:id/output": {
        GET: handleJobOutput,
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

  const shutdown = async () => {
    server.stop();
    await closeBrowser();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
