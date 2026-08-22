# Client/Server Export Mode Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user pick Client (existing WebCodecs/worker export) or Server rendering in the Export dialog; add a Bun HTTP render service in `apps/render` for the server path.

**Architecture:** `apps/render` gains a `POST /render` Bun.serve() route that reuses the existing `probeVideo`/`renderFrames`/`encodeVideo` pipeline against an uploaded video + subtitle JSON, returning the finished MP4 in one response and logging per-request progress to its own stdout. `apps/studio` gains a `useServerVideoExport` hook (same request shape/behavior as `useVideoExport`, minus a worker) and an `ExportDialog` mode toggle that dispatches to whichever hook is selected.

**Tech Stack:** Bun (`Bun.serve`, `bun:test`), existing `apps/render` pipeline (Fabric.js/node-canvas/ffmpeg), React hooks in `apps/studio`, Vite env vars.

**Spec:** [`docs/superpowers/specs/2026-08-22-export-render-mode-toggle-design.md`](file:///Users/video/Desktop/captionly/docs/superpowers/specs/2026-08-22-export-render-mode-toggle-design.md)

## Global Constraints

- No job queue, no polling, no SSE — the server render is a single request/response (spec §1, §3.1).
- Server-side progress is `console.log` only, never sent to the browser (spec §3.2).
- The client (WebCodecs/worker) export path is unchanged (spec §1).
- `SubtitleExportData` (`{lines, style, position, animation}`) is sent to the server as-is — no schema translation (spec §3.1).
- Default render service URL: `http://localhost:4000`, overridable via `VITE_RENDER_SERVER_URL` (spec §4.1).
- **Commit convention override:** the user asked for one commit covering all of this work at the end, not a commit per task. Task steps below therefore do NOT include individual `git commit` steps — only the final task commits.

---

## Task 1: Render HTTP service (`apps/render`)

**Files:**
- Modify: `apps/render/src/encode.ts`
- Create: `apps/render/src/server.ts`
- Create: `apps/render/src/server.test.ts`
- Modify: `apps/render/package.json`

**Interfaces:**
- Consumes: existing `probeVideo(path: string): Promise<VideoInfo>` (`apps/render/src/probe.ts`), existing `renderFrames(lines, style, position, animation, fps, duration): AsyncGenerator<Buffer>` (`apps/render/src/frameRenderer.ts`, unchanged), `@captionly/engine`'s `sampleSubtitles`, `defaultStyle`, `defaultPosition`, `defaultAnimation`.
- Produces: `encodeVideo(inputPath, outputPath, fps, frameGen, totalFrames, onProgress?)` — new optional 6th param `onProgress: (frame: number, total: number) => void`. `createRenderServer(port?: number): ReturnType<typeof Bun.serve>` exported from `server.ts` — later tasks don't consume this (studio only talks HTTP), but the test task does.

- [ ] **Step 1: Write the failing integration test**

Create `apps/render/src/server.test.ts`:

```ts
import { describe, test, expect, afterAll } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRenderServer } from "./server";
import { defaultStyle, defaultPosition, defaultAnimation, sampleSubtitles } from "@captionly/engine";

const server = createRenderServer(0);

afterAll(() => {
  server.stop(true);
});

async function makeFixtureVideo(dir: string): Promise<string> {
  const path = join(dir, "fixture.mp4");
  const proc = Bun.spawn(
    [
      "ffmpeg",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=320x240:d=1:r=10",
      "-pix_fmt",
      "yuv420p",
      path,
    ],
    { stdout: "ignore", stderr: "ignore" },
  );
  const exit = await proc.exited;
  if (exit !== 0) throw new Error("failed to generate fixture video");
  return path;
}

describe("POST /render", () => {
  test("renders an uploaded video with subtitles and returns a valid MP4", async () => {
    const dir = await mkdtemp(join(tmpdir(), "captionly-render-test-"));
    try {
      const videoPath = await makeFixtureVideo(dir);
      const form = new FormData();
      form.append("video", Bun.file(videoPath), "fixture.mp4");
      form.append(
        "subtitles",
        JSON.stringify({
          lines: sampleSubtitles.slice(0, 1),
          style: defaultStyle,
          position: defaultPosition,
          animation: defaultAnimation,
        }),
      );

      const res = await fetch(`http://localhost:${server.port}/render`, {
        method: "POST",
        body: form,
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("video/mp4");

      const outPath = join(dir, "result.mp4");
      await Bun.write(outPath, await res.arrayBuffer());

      const probe = await Bun.$`ffprobe -v quiet -print_format json -show_streams ${outPath}`.json();
      const videoStream = (probe.streams as Array<Record<string, unknown>>).find(
        (s) => s["codec_type"] === "video",
      );
      expect(videoStream).toBeTruthy();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 30000);

  test("rejects a request missing the video field", async () => {
    const form = new FormData();
    form.append("subtitles", "{}");

    const res = await fetch(`http://localhost:${server.port}/render`, {
      method: "POST",
      body: form,
    });

    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/render && bun test src/server.test.ts`
Expected: FAIL — `Cannot find module './server'` (it doesn't exist yet).

- [ ] **Step 3: Add the progress callback to `encode.ts`**

Modify `apps/render/src/encode.ts` — add a 6th parameter with a default that preserves today's CLI console output exactly:

```ts
export async function encodeVideo(
  inputPath: string,
  outputPath: string,
  fps: number,
  frameGen: AsyncGenerator<Buffer>,
  totalFrames: number,
  onProgress: (frame: number, total: number) => void = (frame, total) =>
    process.stdout.write(`\rRendering frame ${frame} / ${total}`),
): Promise<void> {
  const proc = Bun.spawn(
    [
      "ffmpeg",
      "-y",
      "-i",
      inputPath,
      "-f",
      "image2pipe",
      "-framerate",
      String(fps),
      "-i",
      "pipe:0",
      "-filter_complex",
      "[0:v][1:v]overlay=0:0[out]",
      "-map",
      "[out]",
      "-map",
      "0:a?",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "18",
      "-c:a",
      "copy",
      outputPath,
    ],
    {
      stdin: "pipe",
      stdout: "inherit",
      stderr: "inherit",
    },
  );

  let frame = 0;
  for await (const buf of frameGen) {
    frame++;
    onProgress(frame, totalFrames);
    proc.stdin.write(buf);
  }
  process.stdout.write("\n");

  proc.stdin.end();
  const exit = await proc.exited;
  if (exit !== 0) throw new Error(`ffmpeg exited with code ${exit}`);
}
```

`apps/render/src/index.ts` (the CLI script) calls `encodeVideo` with 5 args today, so it keeps using the default logger — no change needed there.

- [ ] **Step 4: Create `apps/render/src/server.ts`**

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { probeVideo } from "./probe";
import { renderFrames } from "./frameRenderer";
import { encodeVideo } from "./encode";
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
    await encodeVideo(inputPath, outputPath, fps, frames, totalFrames, (frame, total) => {
      if (frame === total || frame % 30 === 0) log(`Rendering frame ${frame} / ${total}`);
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
```

- [ ] **Step 5: Add server scripts to `apps/render/package.json`**

Modify the `"scripts"` block:

```json
"scripts": {
  "render": "bun src/index.ts",
  "dev": "bun --watch src/server.ts",
  "start": "bun src/server.ts",
  "test": "bun test"
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd apps/render && bun install && bun test src/server.test.ts`
Expected: PASS — both tests green (the 200/valid-MP4 case may take a few seconds; the 400 case is instant).

---

## Task 2: Studio server-export hook (`apps/studio`)

**Files:**
- Create: `apps/studio/src/export/downloadBlob.ts`
- Modify: `apps/studio/src/export/useVideoExport.ts`
- Create: `apps/studio/src/export/useServerVideoExport.ts`
- Modify: `apps/studio/src/export/index.ts`

Note: `apps/studio`'s `.gitignore` (root `.gitignore:6`) ignores all `.env.*` files, so no env file is created by this plan — `VITE_RENDER_SERVER_URL` is optional and falls back to `http://localhost:4000` in code (Step 3 below). Anyone who needs a different render server URL creates their own local `.env.development` with `VITE_RENDER_SERVER_URL=<url>` — Vite picks it up automatically, no code change needed.

**Interfaces:**
- Consumes: `SubtitleExportData` from `./types` (unchanged).
- Produces: `downloadBlob(blob: Blob, filename?: string): void` (`./downloadBlob`), `useServerVideoExport(): UseServerVideoExportReturn` with `{isExporting: boolean, phase: "uploading" | "rendering" | "complete" | null, error: string | null, exportVideo(videoSource: File | Blob | string, subtitles: SubtitleExportData): Promise<Blob | null>, cancelExport(): void, downloadBlob}` — Task 3 (`ExportDialog`) consumes this exact shape.

There is no automated test runner configured in `apps/studio` (no `vitest`/test script, no `@testing-library/*` dependency), and the spec's own testing plan (§6) calls for manual in-browser verification for the studio side rather than new test infra — adding a test framework here would be scope creep beyond the spec. This task is verified instead with a type-check plus a `curl` contract check against the running render service from Task 1.

- [ ] **Step 1: Extract `downloadBlob` into its own module**

Create `apps/studio/src/export/downloadBlob.ts`:

```ts
export function downloadBlob(blob: Blob, filename = "captionly-video.mp4"): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
```

- [ ] **Step 2: Point `useVideoExport.ts` at the extracted helper**

In `apps/studio/src/export/useVideoExport.ts`:

Replace this import block:

```ts
import { useState, useRef, useCallback, useEffect } from "react";
import type {
  SubtitleExportData,
  ExportOptions,
  ExportProgress,
  MainToWorkerMessage,
  WorkerToMainMessage,
} from "./types";
```

with:

```ts
import { useState, useRef, useCallback, useEffect } from "react";
import { downloadBlob } from "./downloadBlob";
import type {
  SubtitleExportData,
  ExportOptions,
  ExportProgress,
  MainToWorkerMessage,
  WorkerToMainMessage,
} from "./types";
```

Then delete the in-hook definition:

```ts
  const downloadBlob = useCallback((blob: Blob, filename = "captionly-video.mp4") => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, []);
```

The hook's returned object already has a `downloadBlob` key referencing this identifier, so no other line changes — it now resolves to the imported function.

- [ ] **Step 3: Create `useServerVideoExport.ts`**

Create `apps/studio/src/export/useServerVideoExport.ts`:

```ts
import { useState, useRef, useCallback } from "react";
import { downloadBlob } from "./downloadBlob";
import type { SubtitleExportData } from "./types";

export type ServerExportPhase = "uploading" | "rendering" | "complete";

export interface UseServerVideoExportReturn {
  isExporting: boolean;
  phase: ServerExportPhase | null;
  error: string | null;
  exportVideo: (
    videoSource: File | Blob | string,
    subtitles: SubtitleExportData,
  ) => Promise<Blob | null>;
  cancelExport: () => void;
  downloadBlob: (blob: Blob, filename?: string) => void;
}

const RENDER_SERVER_URL = import.meta.env.VITE_RENDER_SERVER_URL ?? "http://localhost:4000";

export function useServerVideoExport(): UseServerVideoExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [phase, setPhase] = useState<ServerExportPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancelExport = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsExporting(false);
    setPhase(null);
    setError(null);
  }, []);

  const exportVideo = useCallback(
    async (
      videoSource: File | Blob | string,
      subtitles: SubtitleExportData,
    ): Promise<Blob | null> => {
      setIsExporting(true);
      setError(null);
      setPhase("uploading");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        let videoBlob: Blob;
        if (typeof videoSource === "string") {
          const res = await fetch(videoSource, { signal: controller.signal });
          if (!res.ok) throw new Error(`Failed to load video from URL: ${res.statusText}`);
          videoBlob = await res.blob();
        } else {
          videoBlob = videoSource;
        }

        const form = new FormData();
        form.append("video", videoBlob, "input.mp4");
        form.append("subtitles", JSON.stringify(subtitles));

        setPhase("rendering");
        const res = await fetch(`${RENDER_SERVER_URL}/render`, {
          method: "POST",
          body: form,
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Render server responded with ${res.status}`);
        }

        const blob = await res.blob();
        setPhase("complete");
        setIsExporting(false);
        return blob;
      } catch (err: unknown) {
        setIsExporting(false);
        if ((err as Error).name === "AbortError") {
          return null;
        }
        const message = (err as Error).message || "Server export failed";
        setError(message);
        throw err;
      } finally {
        abortRef.current = null;
      }
    },
    [],
  );

  return {
    isExporting,
    phase,
    error,
    exportVideo,
    cancelExport,
    downloadBlob,
  };
}
```

- [ ] **Step 4: Update the export barrel**

In `apps/studio/src/export/index.ts`:

```ts
export * from "./types";
export * from "./downloadBlob";
export * from "./useVideoExport";
export * from "./useServerVideoExport";
export * from "./ExportDialog";
export * from "./demuxer";
export * from "./compositor";
export * from "./pipeline";
```

- [ ] **Step 5: Type-check**

Run: `cd apps/studio && bunx tsc --noEmit -p tsconfig.json`
Expected: no new errors (pre-existing errors, if any, are out of scope).

- [ ] **Step 6: Contract-check against the running render service**

With the Task 1 server running (`cd apps/render && bun run dev`), confirm the exact request `useServerVideoExport` sends is accepted:

```bash
curl -s -o /tmp/out.mp4 -w "%{http_code}\n" \
  -F "video=@apps/render/files/input.mp4;type=video/mp4" \
  -F 'subtitles={"lines":[],"style":{},"position":{},"animation":{"type":"none"}}' \
  http://localhost:4000/render
```

Expected: `200`, and `/tmp/out.mp4` is a playable video (`ffprobe /tmp/out.mp4` shows a video stream). This exercises the same field names (`video`, `subtitles`) and multipart shape the hook builds.

---

## Task 3: Export dialog mode toggle (`apps/studio`)

**Files:**
- Modify: `apps/studio/src/export/ExportDialog.tsx`

**Interfaces:**
- Consumes: `useVideoExport()` (unchanged, from Task 2's file), `useServerVideoExport()` (Task 2), `downloadBlob` (Task 2).
- Produces: nothing new consumed elsewhere — this is the leaf UI.

- [ ] **Step 1: Replace `ExportDialog.tsx` in full**

```tsx
import React, { useState } from "react";
import {
  Download,
  Film,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Zap,
  HardDrive,
  Server as ServerIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useVideoExport, type UseVideoExportReturn } from "./useVideoExport";
import { useServerVideoExport } from "./useServerVideoExport";
import { downloadBlob } from "./downloadBlob";
import type { SubtitleExportData } from "./types";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoSrc: string;
  subtitles: SubtitleExportData;
}

export function ExportDialog({ open, onOpenChange, videoSrc, subtitles }: ExportDialogProps) {
  const [mode, setMode] = useState<"client" | "server">("client");

  const {
    isSupported,
    isExporting: clientIsExporting,
    progress,
    error: clientError,
    exportVideo: clientExportVideo,
    cancelExport: clientCancelExport,
  }: UseVideoExportReturn = useVideoExport();

  const serverExport = useServerVideoExport();

  const isExporting = mode === "client" ? clientIsExporting : serverExport.isExporting;
  const error = mode === "client" ? clientError : serverExport.error;
  const cancelExport = mode === "client" ? clientCancelExport : serverExport.cancelExport;

  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);

  const handleStartExport = async () => {
    setExportedBlob(null);

    try {
      const blob =
        mode === "client"
          ? await clientExportVideo(videoSrc, subtitles)
          : await serverExport.exportVideo(videoSrc, subtitles);
      if (blob) {
        setExportedBlob(blob);
      }
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const handleDownload = () => {
    if (exportedBlob) {
      downloadBlob(exportedBlob, `captionly-export-${Date.now()}.mp4`);
    }
  };

  const handleClose = (newOpen: boolean) => {
    if (isExporting && !newOpen) {
      if (confirm("Cancel in-progress video export?")) {
        cancelExport();
        onOpenChange(false);
      }
    } else {
      onOpenChange(newOpen);
    }
  };

  const percent = Math.round((progress?.progress ?? 0) * 100);
  const clientBlocked = mode === "client" && !isSupported;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Export Video with Subtitles
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {mode === "client"
                  ? "Zero-backend, hardware-accelerated in-browser render"
                  : "Uploads to a render service and returns the finished file"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {clientBlocked ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">WebCodecs not supported</p>
              <p className="mt-1 text-muted-foreground">
                Your current browser does not support the WebCodecs API. Please use Google Chrome,
                Microsoft Edge, or Safari 16.4+, or switch to Server export below.
              </p>
            </div>
          </div>
        ) : isExporting ? (
          mode === "client" ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="capitalize text-foreground">
                    {progress?.phase === "demuxing"
                      ? "Demuxing Video Tracks..."
                      : progress?.phase === "rendering"
                        ? "Compositing Subtitles & Encoding..."
                        : progress?.phase === "muxing"
                          ? "Finalizing MP4 Container..."
                          : "Processing..."}
                  </span>
                  <span className="tabular-nums font-semibold text-primary">{percent}%</span>
                </div>
                <Progress value={percent} className="h-2" />
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-secondary/30 p-2.5 text-center text-xs">
                <div>
                  <p className="text-[10px] text-muted-foreground">Render Speed</p>
                  <p className="font-semibold tabular-nums text-foreground mt-0.5">
                    {progress?.fps ? `${progress.fps} fps` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Frames</p>
                  <p className="font-semibold tabular-nums text-foreground mt-0.5">
                    {progress?.totalFrames
                      ? `${progress.currentFrame} / ${progress.totalFrames}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Est. Remaining</p>
                  <p className="font-semibold tabular-nums text-foreground mt-0.5">
                    {progress?.estimatedRemainingSec !== undefined
                      ? `${progress.estimatedRemainingSec}s`
                      : "—"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground justify-center">
                <Zap className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                <span>Rendering on local GPU Web Worker</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-6 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {serverExport.phase === "uploading"
                    ? "Uploading video…"
                    : "Rendering on server…"}
                </p>
                <p className="text-xs text-muted-foreground">
                  This may take a moment depending on video length.
                </p>
              </div>
            </div>
          )
        ) : exportedBlob ? (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Export Complete!</h3>
              <p className="text-xs text-muted-foreground">
                Size: {(exportedBlob.size / (1024 * 1024)).toFixed(2)} MB · H.264 MP4
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("client")}
                className={`rounded-md border px-3 py-2 text-xs font-medium transition ${
                  mode === "client"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                Client
              </button>
              <button
                type="button"
                onClick={() => setMode("server")}
                className={`rounded-md border px-3 py-2 text-xs font-medium transition ${
                  mode === "server"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                Server
              </button>
            </div>

            <div className="rounded-lg bg-secondary/40 p-3 text-xs space-y-1.5 text-muted-foreground">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                {mode === "client" ? (
                  <HardDrive className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <ServerIcon className="h-3.5 w-3.5 text-primary" />
                )}
                <span>{mode === "client" ? "Client-Side Fast Export" : "Server-Side Export"}</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {mode === "client"
                  ? "Video frames and subtitle animations are rendered directly in your browser via WebCodecs. No video is uploaded to external servers."
                  : "Your video is uploaded temporarily to a render service, processed there, and the finished file is sent back to you."}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {isExporting ? (
            <button
              onClick={cancelExport}
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-xs font-medium text-foreground shadow-sm hover:bg-accent transition"
            >
              Cancel
            </button>
          ) : exportedBlob ? (
            <div className="flex w-full gap-2 justify-end">
              <button
                onClick={() => setExportedBlob(null)}
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-xs font-medium text-foreground shadow-sm hover:bg-accent transition"
              >
                Export Again
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition"
              >
                <Download className="h-4 w-4" />
                Download MP4
              </button>
            </div>
          ) : (
            <div className="flex w-full gap-2 justify-end">
              <button
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-xs font-medium text-foreground shadow-sm hover:bg-accent transition"
              >
                Close
              </button>
              <button
                onClick={handleStartExport}
                disabled={clientBlocked}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition disabled:opacity-50 disabled:pointer-events-none"
              >
                <Zap className="h-4 w-4" />
                Start Export
              </button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/studio && bunx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 3: Manual end-to-end verification**

From the repo root: `bun run dev` (boots both `apps/studio` and `apps/render` via Turborepo's generic `dev` task). In the studio UI:
1. Open the Export dialog, leave mode on **Client**, run an export — confirm unchanged behavior (progress bar, download, playable file).
2. Switch to **Server**, run an export — confirm the spinner/phase text appears, the render service's terminal prints `[xxxxxxxx] Probing video…` / `Rendering frame N / total` / `Done` lines, the dialog reaches "Export Complete," and the downloaded file plays with subtitles burned in.
3. Stop the render service, retry a **Server** export — confirm the red error banner appears instead of a hang or crash.

---

## Task 4: Final commit

**Files:** none (staging/commit only).

- [ ] **Step 1: Review the full diff**

Run: `git status && git diff`
Confirm it contains exactly: `apps/render/src/encode.ts`, `apps/render/src/server.ts`, `apps/render/src/server.test.ts`, `apps/render/package.json`, `apps/studio/src/export/downloadBlob.ts`, `apps/studio/src/export/useVideoExport.ts`, `apps/studio/src/export/useServerVideoExport.ts`, `apps/studio/src/export/index.ts`, `apps/studio/src/export/ExportDialog.tsx` (the spec/plan docs were already committed earlier in this session, so they won't show up here).

- [ ] **Step 2: Stage and commit everything as one commit**

```bash
git add apps/render/src/encode.ts apps/render/src/server.ts apps/render/src/server.test.ts apps/render/package.json \
  apps/studio/src/export/downloadBlob.ts apps/studio/src/export/useVideoExport.ts \
  apps/studio/src/export/useServerVideoExport.ts apps/studio/src/export/index.ts \
  apps/studio/src/export/ExportDialog.tsx
git commit -m "$(cat <<'EOF'
feat(export): add server-side render mode alongside client-side export

apps/render is now a Bun HTTP service (POST /render) reusing the existing
probe/render/encode pipeline, with per-request progress logged to stdout.
ExportDialog lets the user pick Client (unchanged WebCodecs path) or Server.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Verify**

Run: `git log --oneline -1 && git status`
Expected: one new commit, clean working tree.
