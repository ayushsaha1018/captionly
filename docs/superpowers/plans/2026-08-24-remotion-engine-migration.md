# Remotion Subtitle Engine Migration Implementation Plan

**Spec:** [`docs/superpowers/specs/2026-08-24-remotion-engine-migration-design.md`](file:///Users/video/Desktop/captionly/docs/superpowers/specs/2026-08-24-remotion-engine-migration-design.md)  
**Date:** 2026-08-24  
**Target:** Replace Fabric.js with Remotion across `packages/engine`, `apps/studio`, and `apps/render`

---

## Proposed Changes

### 1. Monorepo Dependencies
- In [`packages/engine/package.json`](file:///Users/video/Desktop/captionly/packages/engine/package.json):
  - Remove `fabric` from `peerDependencies`.
  - Add `remotion` (`^4.0.0`) and `react` (`^19.0.0`) as peer dependencies.
- In [`apps/studio/package.json`](file:///Users/video/Desktop/captionly/apps/studio/package.json):
  - Remove `fabric`.
  - Add `remotion`, `@remotion/player`, and `@remotion/webcodecs`.
- In [`apps/render/package.json`](file:///Users/video/Desktop/captionly/apps/render/package.json):
  - Remove `fabric` and `canvas` (`node-canvas`).
  - Add `remotion`, `@remotion/renderer`, and `@remotion/bundler`.
- Run `bun install` to regenerate `bun.lock`.

---

### 2. Core Engine Refactor (`packages/engine`)

- **`src/types.ts`**:
  - Update style, animation config, and composition prop interfaces to be declarative and Remotion-native.
- **`src/compositions/MainComposition.tsx`**:
  - Create the top-level Remotion composition containing `<Video />` and `<SubtitleOverlay />`.
- **`src/compositions/SubtitleOverlay.tsx`**:
  - Implement responsive positioning, flexbox wrapping, background pill styling, and safe-zone anchors.
- **`src/animations/`**:
  - Implement React-based animation components using `useCurrentFrame()`, `useVideoConfig()`, and `spring()`:
    - `ColorFillAnimation.tsx` (Word-by-word active highlight & scale)
    - `PopOnAnimation.tsx` (Spring bounce pop-ins)
    - `TypewriterAnimation.tsx` (Progressive typing + cursor)
    - `WipeAnimation.tsx` (CSS clip-path / gradient reveal)
    - `RollUpAnimation.tsx` (Multi-line karaoke scroll)
  - `registry.tsx`: Map animation type strings to animation components.
- **Cleanup**:
  - Delete `src/renderer.ts`, `src/animation.ts`, `src/animations/helpers.ts`, and legacy Fabric strategy files (`ColorFillStrategy.ts`, `DigitalMatrixStrategy.ts`, etc.).
- **`src/index.ts`**:
  - Export compositions, animations, registry, sample data, and types.

---

### 3. Studio Player & Editor (`apps/studio`)

- **`src/subtitle/StudioPlayer.tsx`**:
  - Replace raw `<video>` and canvas overlay with Remotion's `<Player />` component from `@remotion/player`.
- **`src/subtitle/SubtitleEditor.tsx`**:
  - Remove Fabric canvas ref, `SubtitleRenderer` instantiation, and manual 60fps `requestAnimationFrame` render loop.
  - Pass reactive `subtitles` and `videoSrc` state directly into `StudioPlayer`.
- **`src/subtitle/StylePanel.tsx` & `AnimationPanel.tsx`**:
  - Keep existing UI controls and connect directly to React state updates.

---

### 4. Client-Side Video Export (`apps/studio/src/export`)

- **`src/export/useVideoExport.ts`**:
  - Refactor to call `renderMediaOnWeb` from `@remotion/webcodecs` with `licenseKey: 'free-license'`.
  - Stream progress into `ExportDialog.tsx`.
- **Cleanup**:
  - Delete `src/export/compositor.ts` (Fabric OffscreenCanvas compositor).
  - Delete `src/export/worker-polyfill.ts` (DOM mocks for Fabric).

---

### 5. Server-Side Export Fallback (`apps/render`)

- **`src/remotionRoot.tsx`**:
  - Create Remotion composition registration entrypoint for headless bundling.
- **`src/server.ts`**:
  - Migrate `POST /render` handler to bundle via `@remotion/bundler` and render via `@remotion/renderer` (`renderMedia` with `licenseKey: 'free-license'`).
- **Cleanup**:
  - Delete `src/frameRenderer.ts` and `src/encode.ts` (replaced by Remotion's built-in encoder).

---

## Step-by-Step Task Breakdown

### Task 1: Package Dependencies & Lockfile
- [ ] Update `packages/engine/package.json`, `apps/studio/package.json`, and `apps/render/package.json`.
- [ ] Run `bun install` to update workspace dependencies and lockfile.

### Task 2: Implement Remotion Subtitle Engine (`packages/engine`)
- [ ] Refactor `packages/engine/src/types.ts`.
- [ ] Create `packages/engine/src/compositions/MainComposition.tsx` and `SubtitleOverlay.tsx`.
- [ ] Implement declarative animations in `packages/engine/src/animations/` (`ColorFillAnimation.tsx`, `PopOnAnimation.tsx`, `TypewriterAnimation.tsx`, `WipeAnimation.tsx`, `RollUpAnimation.tsx`, `registry.tsx`).
- [ ] Remove obsolete Fabric.js renderer and strategy files.
- [ ] Update `packages/engine/src/index.ts` exports.

### Task 3: Migrate Studio Preview to Remotion Player (`apps/studio`)
- [ ] Update `apps/studio/src/subtitle/StudioPlayer.tsx` to use `@remotion/player`.
- [ ] Refactor `apps/studio/src/subtitle/SubtitleEditor.tsx` to remove imperative canvas loop and pass reactive props to player.
- [ ] Verify `StylePanel.tsx` and `AnimationPanel.tsx` trigger real-time preview updates.

### Task 4: Migrate Client-Side WebCodecs Export (`apps/studio/src/export`)
- [ ] Refactor `apps/studio/src/export/useVideoExport.ts` with `renderMediaOnWeb`.
- [ ] Delete `apps/studio/src/export/compositor.ts` and `apps/studio/src/export/worker-polyfill.ts`.
- [ ] Verify `ExportDialog.tsx` renders progress and downloads exported MP4.

### Task 5: Migrate Server-Side Export Service (`apps/render`)
- [ ] Implement `apps/render/src/remotionRoot.tsx`.
- [ ] Refactor `apps/render/src/server.ts` to use `@remotion/renderer`.
- [ ] Remove `apps/render/src/frameRenderer.ts` and legacy node-canvas code.

### Task 6: Monorepo Build, Typecheck & End-to-End Verification
- [ ] Run `bun run lint` and `bun run build` across all workspace packages.
- [ ] Test Studio player playback, seeking, and live style edits in browser.
- [ ] Test in-browser WebCodecs MP4 export and server-side fallback export.
