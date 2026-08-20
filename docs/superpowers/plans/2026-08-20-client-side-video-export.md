# Client-Side Video & Subtitle Export Implementation Plan

**Spec:** [`docs/superpowers/specs/2026-08-20-client-side-video-export-design.md`](file:///Users/video/Desktop/captionly/docs/superpowers/specs/2026-08-20-client-side-video-export-design.md)  
**Date:** 2026-08-20  
**Target:** In-browser WebCodecs + mp4-muxer export in `apps/studio` and `packages/engine`

---

## Proposed Changes

### 1. Dependencies Setup
- Add `mp4-muxer` and `mp4box` (or `@types/mp4box`) to `apps/studio` and `packages/engine`.

### 2. Export Core Engine (`packages/engine/src/export` or `apps/studio/src/export`)
- **`demuxer.ts`**:
  - MP4Box wrapper to parse MP4 metadata (width, height, duration, fps, codec description `avcC`).
  - Extract video samples as `EncodedVideoChunk`.
  - Extract audio samples for AAC passthrough.
- **`compositor.ts`**:
  - Sets up `OffscreenCanvas` and renders subtitles via `@captionly/engine` on top of decoded `VideoFrame`s.
- **`pipeline.ts`**:
  - Coordinates `VideoDecoder` $\rightarrow$ `compositor` $\rightarrow$ `VideoEncoder` $\rightarrow$ `mp4-muxer`.
  - Implements backpressure (`encodeQueueSize <= 5`) and immediate `VideoFrame.close()`.
- **`export.worker.ts`**:
  - Web Worker entrypoint receiving `START_EXPORT` / `CANCEL_EXPORT` and emitting `PROGRESS`, `COMPLETE`, and `ERROR` events.

### 3. Studio UI Integration (`apps/studio`)
- **`useVideoExport.ts`**:
  - React hook managing worker lifecycle, progress state (`0–100%`, rendered frames, remaining time), and download trigger.
- **`ExportDialog.tsx` or Export Button in `apps/studio`**:
  - UI modal / progress bar with download button and cancel support.

---

## Step-by-Step Task Breakdown

### Task 1: Add Dependencies
- Install `mp4-muxer` and `mp4box` in `apps/studio` / `packages/engine`.

### Task 2: Implement MP4 Demuxer (`demuxer.ts`)
- Parse input `File` into video metadata (dimensions, duration, framerate, `avcC` description) and audio metadata.
- Provide chunk generator/callback for video and audio samples.

### Task 3: Implement Offscreen Canvas Compositor (`compositor.ts`)
- Render video frame to `OffscreenCanvas`.
- Apply `@captionly/engine` word-by-word subtitle rendering at frame timestamp.
- Extract new `VideoFrame`.

### Task 4: Implement WebCodecs Pipeline & Muxer (`pipeline.ts`)
- Initialize `VideoDecoder` and `VideoEncoder`.
- Feed composited frames with backpressure.
- Pass audio samples untouched to `mp4-muxer`.
- Finalize and return MP4 `ArrayBuffer`.

### Task 5: Implement Web Worker (`export.worker.ts`)
- Wrap the pipeline in worker message handlers (`postMessage`).
- Emit throttled progress events (every 100ms or 15 frames) for smooth UI updates.

### Task 6: Implement Studio Hook & UI Component
- Add `useVideoExport` hook.
- Add an "Export Video" button and progress modal to `apps/studio/src/subtitle/SubtitleEditor.tsx` / `VideoControls.tsx`.

### Task 7: Verification & Testing
- Test with sample MP4 video.
- Verify exported MP4 in browser, VLC, and QuickTime.
- Verify subtitle sync and visual animations.
