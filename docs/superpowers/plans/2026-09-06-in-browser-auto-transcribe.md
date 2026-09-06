# In-Browser Auto-Transcription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 100% in-browser auto-transcription for uploaded videos using `@remotion/whisper-webgpu` and `@remotion/captions`.

**Architecture:** A pure client-side pipeline in `@captionly/studio/src/transcribe` that verifies WebGPU support, resamples video audio tracks to 16kHz mono using Web Audio APIs, downloads and caches Hugging Face Whisper models locally, runs WebGPU inference, formats caption tokens into short or standard lines via `@remotion/captions`, and populates the Captionly document.

**Tech Stack:** React 19, TypeScript, Remotion v4.0.521 (`@remotion/whisper-webgpu`, `@remotion/captions`), Radix UI / Shadcn, Bun Test, Zustand v5.

---

## File Structure Map

```
apps/studio/
├── package.json
├── src/
│   ├── transcribe/
│   │   ├── types.ts                    # Model, pacing, and progress types
│   │   ├── captionConverter.ts         # TikTokPage -> SubtitleLine[] mapping
│   │   ├── captionConverter.test.ts    # Unit tests for time conversion and word structure
│   │   ├── transcribeService.ts        # Resampling, model loading, and WebGPU transcription
│   │   └── TranscribeModal.tsx         # Dialog with model select, pacing select & progress
│   ├── store/
│   │   ├── types.ts                    # DocumentSlice with setLines (no undo)
│   │   ├── documentSlice.ts            # setLines implementation
│   │   └── documentSlice.test.ts       # Test setLines updates state without commit
│   ├── app/
│   │   └── PlayerRail.tsx              # Trigger prompt on video upload
│   └── lines/
│       └── LinesPanel.tsx              # Manual "Auto-Transcribe" button
```

---

### Task 1: Install Remotion Whisper & Captions Packages

**Files:**
- Modify: `apps/studio/package.json`

- [ ] **Step 1: Add `@remotion/whisper-webgpu` and `@remotion/captions` to dependencies**
  Run `bun add @remotion/whisper-webgpu@4.0.521 @remotion/captions@4.0.521` in `apps/studio`.
- [ ] **Step 2: Verify package installation and lockfile update**
  Run `bun install` at repo root to ensure workspace consistency.

---

### Task 2: Caption Converter & Unit Tests

**Files:**
- Create: `apps/studio/src/transcribe/types.ts`
- Create: `apps/studio/src/transcribe/captionConverter.ts`
- Create: `apps/studio/src/transcribe/captionConverter.test.ts`

- [ ] **Step 1: Write `types.ts`**
  Define `WhisperModelOption` (`"base.en" | "tiny.en" | "small.en"`), `PacingOption` (`"reel" | "standard"`), and progress tracking types.
- [ ] **Step 2: Write failing unit tests in `captionConverter.test.ts`**
  Cover:
  - Millisecond to second conversion (`startMs -> start`, `durationMs -> end - start`).
  - Word parsing (`fromMs -> start`, `toMs -> end`, trimmed text, generated UUIDs).
  - Empty page handling.
- [ ] **Step 3: Run `bun test` to confirm test failure**
- [ ] **Step 4: Implement `captionConverter.ts`**
  Implement `mapTikTokPagesToSubtitleLines(pages: TikTokPage[]): SubtitleLine[]`.
- [ ] **Step 5: Run `bun test` to confirm tests pass**

---

### Task 3: Store Support for Setting Subtitles Without History Bloat

**Files:**
- Modify: `apps/studio/src/store/types.ts`
- Modify: `apps/studio/src/store/documentSlice.ts`
- Modify: `apps/studio/src/store/documentSlice.test.ts`

- [ ] **Step 1: Write unit test in `documentSlice.test.ts`**
  Verify `setLines(lines)` updates `state.lines`, selects the first line, and does NOT record a past history entry (preserves undo stack).
- [ ] **Step 2: Add `setLines` to `DocumentSlice` interface in `types.ts`**
- [ ] **Step 3: Implement `setLines` in `documentSlice.ts`**
- [ ] **Step 4: Run `bun test` to ensure store tests pass**

---

### Task 4: In-Browser Transcription Service

**Files:**
- Create: `apps/studio/src/transcribe/transcribeService.ts`

- [ ] **Step 1: Implement `checkWebGpuSupport(): Promise<{ supported: boolean; reason?: string }>`**
  Wrap `canUseWhisperWebGpu()` with clean error handling.
- [ ] **Step 2: Implement `runTranscriptionPipeline()`**
  Coordinates:
  1. `resampleTo16Khz({ file, onProgress })`
  2. `loadWhisperModel({ model, onProgress })`
  3. `transcribe({ channelWaveform, model })`
  4. `toCaptions({ whisperWebGpuOutput })`
  5. `createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds })`
  6. `mapTikTokPagesToSubtitleLines(pages)`
  Calls a status callback at each stage for UI progress reporting.

---

### Task 5: TranscribeModal Component

**Files:**
- Create: `apps/studio/src/transcribe/TranscribeModal.tsx`

- [ ] **Step 1: Build the Dialog modal using Radix UI / Shadcn**
  - Open state controlled by prop or store.
  - Model selection dropdown (`base.en` default, `tiny.en`, `small.en`).
  - Pacing dropdown: Short phrases (Reels / TikTok) vs Standard lines (YouTube).
  - Unsupported WebGPU warning banner when `checkWebGpuSupport()` returns false.
- [ ] **Step 2: Build the in-progress state**
  - Progress bar during model download (with %).
  - Status messages: "Extracting audio track...", "Downloading Whisper model...", "Transcribing speech with WebGPU...".
  - Disable action buttons while running.
- [ ] **Step 3: Handle completion & errors**
  - On complete: call `setLines(lines)`, display success toast, close modal.
  - On error: display friendly error with "Try Again" button.

---

### Task 6: Integrate Video Upload Trigger & Manual Button

**Files:**
- Modify: `apps/studio/src/app/PlayerRail.tsx`
- Modify: `apps/studio/src/lines/LinesPanel.tsx` (or LineList header)

- [ ] **Step 1: Hook `PlayerRail.tsx` to prompt `TranscribeModal`**
  When a user drops/selects a video file, after `extractVideoMetadata(file)` succeeds, check WebGPU support and open `TranscribeModal`.
- [ ] **Step 2: Add "Auto-Transcribe" button in Subtitle Lines UI**
  In `LinesPanel.tsx` (top bar or empty state), allow opening `TranscribeModal` manually for the currently loaded video.
- [ ] **Step 3: Run full linter and test suite**
  Run `bun test` and `turbo run lint` to guarantee clean code.

---

### Task 7: End-to-End Verification

- [ ] **Step 1: Start frontend dev server (`bun run dev:frontend`)**
- [ ] **Step 2: Test importing a video file**
  - Verify modal appears automatically after upload.
  - Verify model selector and pacing selector work.
  - Start transcription, monitor download and transcription progress.
  - Verify generated subtitles display properly in preview and timeline with synchronized word highlights.
- [ ] **Step 3: Test manual trigger from Lines panel**
  - Click "Auto-Transcribe" from the panel.
  - Re-transcribe with different pacing and verify subtitles update seamlessly.
