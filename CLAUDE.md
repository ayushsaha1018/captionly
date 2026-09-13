# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **Bun** (v1.3.4). Root scripts run across the Turborepo workspace via `turbo`.

```bash
bun install                              # install all workspaces

bun run dev                              # run all apps (studio @ :5173, render @ :4000)
bun run dev:frontend                     # studio only
cd apps/render && bun run dev            # render server only (--watch)

bun run build                            # turbo build (engine -> studio/render via dependsOn)
bun run build:frontend                   # studio build only

bun run lint                             # turbo lint (eslint, studio only has a lint script)
bun run test                             # turbo test (bun test) across all workspaces

# single test file, run from repo root or the workspace dir
bun test packages/engine/src/wordTiming.test.ts
bun test apps/studio/src/store/historySlice.test.ts
bun test --watch <path>                  # watch mode
```

Tests are colocated `*.test.ts` files using `bun test` (no Jest/Vitest). There is no per-file "run single test by name" flag beyond bun's own `-t <pattern>` filter.

CI (`.github/workflows/test.yml`) runs `bun install --frozen-lockfile` then `bun run test` on push/PR to `main`, with FFmpeg installed for the render app.

## Architecture

Turborepo monorepo, three workspaces. `@captionly/engine` has no workspace dependencies; `@captionly/studio` and `@captionly/render` both depend on it (`workspace:*`), so engine changes require studio/render to pick them up (turbo's `dependsOn: ["^build"]` handles ordering for `build`, but `dev`/`test` do not rebuild engine automatically — restart `dev:frontend` or re-run engine tests directly after editing engine source).

- **`packages/engine`** — pure Remotion React library, framework-agnostic w.r.t. the studio UI. This is the single source of truth for how a subtitle document renders to pixels, used identically by the browser player (`@remotion/player`), the client WebCodecs exporter, and the headless server renderer — never duplicate rendering logic in `apps/studio` or `apps/render`.
  - `compositions/` — `MainComposition` (top-level Remotion composition) and `SubtitleOverlay` (positions/sizes the active line using safe-zone-aware geometry).
  - `animations/registry.tsx` — `SubtitleAnimationRenderer` switches on `AnimationConfig.type` to one of 9 animation components (`NoneAnimation`, `ColorFillAnimation`, `PopOnAnimation`, `TypewriterAnimation`, `WipeAnimation`, `RollUpAnimation`, `PaintOnAnimation`, `FlapBoardAnimation`, `DigitalMatrixAnimation`). Adding a new animation strategy means: new component in `animations/`, a case in the registry switch, an entry in `types.ts`'s `AnimationConfig` union, and usually a preset in `presets.ts`.
  - `wordTiming.ts` — character-weighted word-timing distribution algorithm (punctuation pause bonuses, iterative water-filling minimum-duration floor). This is what turns a line's plain text + [start,end] into per-word timing; both auto-transcribe pacing and manual line-edit retiming go through this.
  - `utils/geometry.ts` — resolution/aspect-ratio-independent scaling (typography, strokes, shadows, padding, safe zones) so the same style config renders correctly at 16:9, 9:16, and 4K.
  - `fonts/googleFonts.ts` — Google Fonts catalogue + loader.
  - Exported surface is `src/index.ts` — add new public exports there, not by deep-importing into consumers.

- **`apps/studio`** — Vite + React 19 + TanStack Router + Tailwind v4 web app.
  - `src/store/` — single Zustand store (`useStudioStore`) composed from slices: `documentSlice` (the `DocumentSnapshot` — video, lines, style, animation, position; this is exactly what gets undo-snapshotted and exactly what export operates on), `editorSlice` (selection/editing/active-tab UI state, not undoable), `historySlice` (past/future stacks over `DocumentSnapshot`, with a `coalesceKey` mechanism so rapid keystrokes into the same field collapse into one undo step — `commit(label, { coalesceKey })`). `replaceDocument` is history's own restore path and must not itself push a new history entry.
  - `src/lines/` — the vertical transcript timeline (the app's core interaction surface): line rows, playhead sync, boundary controls. Two-way bound to video playback time.
  - `src/subtitle/` — style panel, animation panel, safe-zone overlays, and the `@remotion/player` preview, all driven by the same `SubtitleStyle`/`AnimationConfig`/`SubtitlePosition` types the engine consumes.
  - `src/transcribe/` — in-browser Whisper WebGPU transcription (`@remotion/whisper-webgpu`); `captionConverter.ts` turns Whisper's word-level output into `SubtitleLine[]` using a pacing preset (short-form vs long-form), which is where `wordTiming.ts` gets invoked.
  - `src/export/` — two independent export paths sharing the same engine composition: `useVideoExport` (client-side, `@remotion/web-renderer` + WebCodecs, no network) and `useServerVideoExport` (posts to `apps/render`'s HTTP server).
  - Routing is TanStack Router with a generated `routeTree.gen.ts` (don't hand-edit; regenerated from `src/routes/`).

- **`apps/render`** — headless Bun service around `@remotion/bundler` + `@remotion/renderer`. `src/server.ts` is the HTTP entrypoint (`POST /render`), `src/index.ts` is the CLI entrypoint, `src/probe.ts` inspects input video duration/dimensions before rendering. Renders the same `MainComposition` from `@captionly/engine` server-side to produce the final MP4 — this is the fallback for browsers without WebCodecs/WebGPU support.

### Data flow in one line
Video import → Whisper transcription or manual entry → `SubtitleLine[]` timed via `wordTiming.ts` → edited/spotted against playback in `src/lines` → styled via `SubtitleStyle`/`AnimationConfig` in `src/subtitle` → rendered through `SubtitleAnimationRenderer` (same code path for live preview, client export, and server export) → exported to MP4 client-side or via `apps/render`.

### Planning docs
`docs/superpowers/` holds this repo's design-doc history (`plans/` and `specs/`, dated) — check there for the rationale behind past architectural decisions (e.g. the Fabric→Remotion migration, the export/render-mode toggle) before re-deriving them from scratch.
