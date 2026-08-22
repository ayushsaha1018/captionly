# Fabric.js v7 Migration Implementation Plan

**Spec:** [`docs/superpowers/specs/2026-08-20-fabric-v7-migration-design.md`](file:///Users/video/Desktop/captionly/docs/superpowers/specs/2026-08-20-fabric-v7-migration-design.md)  
**Date:** 2026-08-20  
**Target:** Upgrade from Fabric.js `5.3.0` to `7.4.0` across the monorepo  

---

## Proposed Changes

### 1. Package Dependencies
- Upgrade `fabric` to `^7.4.0` in:
  - `packages/engine/package.json` (`peerDependencies`)
  - `apps/render/package.json` (`dependencies`)
  - `apps/studio/package.json` (`dependencies`)
- Remove `@types/fabric` in `devDependencies` across all three packages.
- Run `bun install` to update `bun.lock`.

### 2. Core Engine (`packages/engine`)
- **`src/renderer.ts`**:
  - Delete Fabric 5.3.0 `_setTextStyles` baseline patch (lines 14–47).
  - Use `import { Canvas } from "fabric"`.
- **`src/animations/types.ts`**:
  - Update `UpdateCtx` and `AnimationStrategy` signatures to use `Canvas` from `fabric`.
- **`src/animations/helpers.ts`**:
  - Update `BackgroundLayer` to use `Canvas`, `Rect`, and `FabricObject` from `fabric`.
- **`src/animations/*.ts`** (9 Strategies):
  - Convert all strategies to named imports (`Canvas`, `FabricText`, `Textbox`, `Group`, `Shadow`, `Rect`).
  - Replace `new fabric.Text` with `new FabricText`, `new fabric.Textbox` with `new Textbox`, etc.

### 3. Headless Frame Renderer (`apps/render`)
- **`src/frameRenderer.ts`**:
  - Use `import { StaticCanvas } from "fabric/node"`.
  - Remove `(globalThis).document = fabric.document` injection.
  - Remove `jsdomImplForWrapper` hack; export PNG buffers cleanly via Fabric v7 / node-canvas methods.

### 4. Studio UI & Web Worker Export (`apps/studio`)
- **`src/subtitle/SubtitleEditor.tsx`**:
  - Use `import { Canvas } from "fabric"`.
  - Update canvas references and constructor.
- **`src/export/compositor.ts`**:
  - Use `import { StaticCanvas, Canvas } from "fabric"`.
  - Remove duplicate `makeFabricCompatible` function.
- **`src/export/worker-polyfill.ts`**:
  - Clean up and retain minimal mock DOM required for Fabric v7 on `OffscreenCanvas`.

---

## Step-by-Step Task Breakdown

### Task 1: Update Dependencies & Lockfile
- [ ] Edit `packages/engine/package.json`, `apps/render/package.json`, `apps/studio/package.json`.
- [ ] Run `bun install` at workspace root.

### Task 2: Refactor `@captionly/engine`
- [ ] Update `packages/engine/src/renderer.ts` (remove v5 baseline patch, switch to named imports).
- [ ] Update `packages/engine/src/animations/types.ts` and `helpers.ts`.
- [ ] Update all 9 animation strategies in `packages/engine/src/animations/`:
  - `ColorFillStrategy.ts`
  - `DigitalMatrixStrategy.ts`
  - `FlapBoardStrategy.ts`
  - `PaintOnStrategy.ts`
  - `PopOnStrategy.ts`
  - `RollUpStrategy.ts`
  - `StaticStubStrategy.ts`
  - `TickerStrategy.ts`
  - `TypewriterStrategy.ts`
  - `WipeStrategy.ts`

### Task 3: Refactor `apps/render`
- [ ] Update `apps/render/src/frameRenderer.ts` to use `fabric/node`.
- [ ] Remove `fabric.document` and `jsdomImplForWrapper` hacks.

### Task 4: Refactor `apps/studio`
- [ ] Update `apps/studio/src/subtitle/SubtitleEditor.tsx`.
- [ ] Remove duplicate polyfill from `apps/studio/src/export/compositor.ts` and switch to named imports.
- [ ] Clean up `apps/studio/src/export/worker-polyfill.ts`.

### Task 5: Build, Lint & Runtime Verification
- [ ] Run `bun run lint` (verify zero TypeScript and ESLint errors).
- [ ] Run `bun run build` (verify all packages and Vite SSR/worker builds succeed).
- [ ] Verify runtime behavior in `apps/studio` and `apps/render`.
