# Client/Server Export Mode Toggle Design Spec

**Date:** 2026-08-22
**Status:** Approved for Implementation Planning
**Target:** `apps/studio/src/export`, `apps/render`

---

## 1. Overview & Problem Statement

`apps/studio` currently has one export path: fully client-side, WebCodecs-based rendering in a Web Worker (`apps/studio/src/export/*`, see `2026-08-20-client-side-video-export-design.md`). Even worker-based, this path still visibly taxes the browser during export on some machines/clips, and there's no alternative for users who'd rather offload the work.

Separately, `apps/render` already contains a working server-side render pipeline (Fabric.js + node-canvas + ffmpeg, per the original backend approach) but it only exists as a standalone Bun CLI script (`src/index.ts`) that reads hardcoded files from `apps/render/files/` and writes to `apps/render/output/` — it is not reachable from the browser.

### Goal

Let the user pick **Client** (today's WebCodecs path, default) or **Server** (new) rendering in the Export dialog, and dispatch the export accordingly:

- **Client:** unchanged.
- **Server:** `apps/render` becomes a small Bun HTTP service. Studio uploads the source video + subtitle data, the service renders with the existing pipeline, and returns the finished MP4 in the same HTTP response. No job queue, no polling, no live progress pushed to the browser — progress is simply logged server-side to stdout, as the CLI script already does today.

---

## 2. Architecture

```
apps/studio (browser)                      apps/render (Bun.serve(), new)
┌─────────────────────────────┐            ┌──────────────────────────────┐
│ ExportDialog                │            │ POST /render                 │
│  ├─ mode: 'client'|'server'│            │  1. write upload -> temp file│
│  │   (default 'client')    │            │  2. probeVideo()             │
│  │                          │  multipart │  3. renderFrames()  (existing)│
│  ├─ client -> useVideoExport│  video +   │  4. encodeVideo()   (existing)│
│  │   (unchanged, worker)    │  subtitles │  5. read output -> Buffer     │
│  │                          │ ─────────► │  6. delete temp files (finally)│
│  └─ server -> useServer     │            │  7. respond 200 video/mp4     │
│      VideoExport (new)      │ ◄───────── │                               │
│                              │  mp4 bytes │  console.log progress lines  │
└─────────────────────────────┘            │  (prefixed with a short       │
                                            │   per-request id)             │
                                            └──────────────────────────────┘
```

Both modes end with `ExportDialog` holding a `Blob` and using the existing "Export Complete → Download" UI — the two hooks return the same shape, so the dialog's completed/error states don't need to branch by mode.

---

## 3. `apps/render` HTTP Service

### 3.1 New file: `apps/render/src/server.ts`

- `Bun.serve()` with a single route: `POST /render`.
- Request: `multipart/form-data` with fields:
  - `video`: the source video file.
  - `subtitles`: JSON string matching `SubtitleExportData` (`{lines, style, position, animation}` from `@captionly/engine`) — this is exactly the shape `apps/render/src/index.ts` already parses from `files/subtitles.json`, so no translation layer is needed.
- Handler:
  1. Generate a short request id (`crypto.randomUUID().slice(0, 8)`).
  2. Write the uploaded video to a temp file (`os.tmpdir()` + request id).
  3. Reuse `probeVideo`, `renderFrames`, `encodeVideo` unchanged (they already operate on file paths / async generators).
  4. Read the resulting output file into a `Buffer`.
  5. Delete the temp input/output files in a `finally` (covers ffmpeg non-zero exit too).
  6. Respond `200` with `Content-Type: video/mp4` and the buffer as body.
- CORS: add `Access-Control-Allow-Origin` (studio's dev origin, or `*` for now) response header. A `multipart/form-data` POST is a CORS "simple request," so no preflight/OPTIONS handling is required.
- Errors (bad upload, ffmpeg failure, probe failure): respond non-2xx with a short JSON `{error: string}` body; no partial file is left behind because of the `finally` cleanup.

### 3.2 Progress logging

- `renderFrames` (`apps/render/src/frameRenderer.ts`) and `encodeVideo` (`apps/render/src/encode.ts`) each take an optional `onProgress?: (frame: number, total: number) => void` parameter (default no-op). This is a signature addition only — no new abstraction, no behavior change for the existing CLI caller unless it opts in.
- `server.ts` passes a closure that does `console.log(`[${requestId}] frame ${frame}/${total}`)` (replacing/alongside the existing `process.stdout.write` line in `encode.ts`, now prefixed per-request so concurrent renders stay distinguishable in the terminal).
- This is server-operator-facing only — nothing is sent to the browser.

### 3.3 `apps/render/package.json`

- Add scripts:
  - `"dev": "bun --watch src/server.ts"`
  - `"start": "bun src/server.ts"`
- `turbo.json`'s existing generic `dev` task (`cache: false, persistent: true`) already applies to any workspace with a `dev` script, so `turbo run dev` at the repo root will boot the render service alongside studio with no turbo.json change.

---

## 4. `apps/studio` Changes

### 4.1 Env var

- `VITE_RENDER_SERVER_URL`, default `http://localhost:4000`.

### 4.2 New hook: `apps/studio/src/export/useServerVideoExport.ts`

Mirrors the existing `UseVideoExportReturn` shape (`isExporting`, `progress` (simplified), `error`, `exportVideo`, `downloadBlob`) so `ExportDialog` can switch hooks by mode with minimal branching:

- `exportVideo(videoSource, subtitles)`:
  1. Resolve `videoSource` to a `Blob`/`ArrayBuffer` (reuse the same fetch-if-string logic already in `useVideoExport`).
  2. Set phase state to `"uploading"`.
  3. Build `FormData` with `video` + `subtitles` (JSON.stringify).
  4. `fetch(`${RENDER_SERVER_URL}/render`, {method: 'POST', body: formData})`; once the request is sent, flip phase to `"rendering"` (best-effort — a single fetch call can't distinguish "still uploading" from "server now rendering," so this is approximate, shown only as status text, not a progress bar).
  5. On success: `await res.blob()`, set phase `"complete"`, resolve with the blob.
  6. On failure (network error or non-2xx): set `error`, reject.
- `downloadBlob`: reuse the existing utility (already generic, not worker-specific) — either import it from `useVideoExport.ts` or duplicate the ~8 lines; prefer importing to avoid duplication.
- No `cancelExport` beyond aborting the in-flight `fetch` via `AbortController` (parity with the client path's cancel button).

### 4.3 `ExportDialog.tsx` changes

- Add `mode` state, default `"client"`. Small segmented control (two buttons, matching existing button styling) — "Client" / "Server" — shown above the export button when not exporting/complete.
- Copy: "Client — renders in your browser, nothing is uploaded" / "Server — offloads rendering, your video is uploaded temporarily."
- `handleStartExport` calls whichever hook's `exportVideo` based on `mode`.
- Exporting UI:
  - `client`: unchanged (frame progress bar, fps, ETA).
  - `server`: indeterminate spinner + phase text ("Uploading…" / "Rendering on server…"), no frame-level progress bar (per the "just log progress on the server, not the UI" decision).
- Complete/error states: unchanged, shared between both modes since both hooks resolve to a `Blob`.

---

## 5. Error Handling

- Server unreachable, request timeout, non-2xx, or malformed response → surfaced via the same red-banner `error` UI the client path already uses. No automatic fallback to client mode.
- Server-side: any thrown error during probe/render/encode is caught, temp files are cleaned up in `finally`, and a JSON error response is sent — the process itself must not crash on a single bad request (one request's failure shouldn't take down the service for others).

---

## 6. Testing Plan

- **`apps/render`:** one `bun test` that POSTs a small fixture video + subtitles JSON to a locally started instance of the server, asserts `200` and that the returned bytes are a valid MP4 (e.g. via `ffprobe` on the response buffer written to a temp file). Mirrors the existing manual verification style of the CLI script.
- **`apps/studio`:** manual verification in-browser for both modes end-to-end (start dev servers via `turbo run dev`, run an export in each mode, confirm playable output and correct UI states, including the error banner when the render service is stopped).
