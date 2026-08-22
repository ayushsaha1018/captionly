# Design Specification: Fabric.js v7 Migration

**Date:** 2026-08-20  
**Target Version:** Fabric.js `7.4.0` (Latest)  
**Status:** Approved  

---

## 1. Overview & Goals

This specification details the end-to-end migration of the Captionly monorepo from Fabric.js `5.3.0` to Fabric.js `7.4.0`.

### Key Objectives
1. **Modernize Imports & Types**: Migrate from legacy global/namespace imports (`import { fabric } from "fabric"`) to modern ESM named imports (`Canvas`, `StaticCanvas`, `FabricText`, `Textbox`, `Group`, `Shadow`, `Rect`).
2. **Remove Outdated Type Packages**: Remove `@types/fabric` across all workspaces since Fabric v7 is written natively in TypeScript with bundled definitions.
3. **Eliminate Fabric v5 Polyfills & Hacks**:
   - Remove the `fabric.Text.prototype._setTextStyles` text baseline patch in `@captionly/engine`.
   - Remove `fabric.document` global injection and `jsdomImplForWrapper` hacks in `apps/render`.
   - Remove the duplicate `makeFabricCompatible` function in `apps/studio/src/export/compositor.ts` and streamline `worker-polyfill.ts`.
4. **Preserve Subtitle Rendering Quality & Behavior**: Maintain exact visual parity and determinism across all 9 subtitle animation strategies in both the interactive UI and video export pipelines.

---

## 2. Monorepo Package Changes

| Workspace | Package File | Dependency Changes |
|---|---|---|
| Engine | `packages/engine/package.json` | Upgrade `peerDependencies.fabric` to `^7.4.0`; remove `devDependencies.@types/fabric` |
| Render | `apps/render/package.json` | Upgrade `dependencies.fabric` to `^7.4.0`; remove `devDependencies.@types/fabric` |
| Studio | `apps/studio/package.json` | Upgrade `dependencies.fabric` to `^7.4.0`; remove `devDependencies.@types/fabric` |

After updating `package.json` files, run `bun install` to update the lockfile.

---

## 3. Package & Module Implementation

### 3.1 `@captionly/engine`

#### 3.1.1 `src/renderer.ts`
- **Remove v5 Baseline Patch**: Delete lines 14–47 monkey-patching `fabric.Text.prototype._setTextStyles`.
- **Imports**: Replace `import { fabric } from "fabric"` with `import { Canvas } from "fabric"`.
- **Typing**: Update `SubtitleRenderer` private `canvas` field to `Canvas`.

#### 3.1.2 `src/animations/types.ts`
- Replace `import type { fabric } from "fabric"` with `import type { Canvas } from "fabric"`.
- Update `UpdateCtx.canvas: Canvas`.
- Update `AnimationStrategy.mount(canvas: Canvas): void`.

#### 3.1.3 `src/animations/helpers.ts`
- Replace `import { fabric } from "fabric"` with `import { Canvas, Rect, FabricObject } from "fabric"`.
- `BackgroundLayer`:
  - `canvas: Canvas`
  - `rect: Rect | null`
  - `target: FabricObject | null`
  - Instantiation: `new Rect({ ... })`

#### 3.1.4 9 Animation Strategies (`src/animations/*`)
Convert each strategy from `fabric.*` to named imports:
- **`ColorFillStrategy.ts`**:
  - Imports: `Canvas, FabricText, Group, Shadow`
  - Type `LetterObj.text: FabricText` and `LineCache.group: Group | null`
  - Instantiation: `new FabricText(...)`, `new Shadow(...)`, `new Group(...)`
- **`DigitalMatrixStrategy.ts`**:
  - Imports: `Canvas, Textbox, Shadow`
  - Instantiation: `new Textbox(...)`, `new Shadow(...)`
- **`FlapBoardStrategy.ts`**:
  - Imports: `Canvas, FabricText`
  - Instantiation: `new FabricText(...)`
- **`PaintOnStrategy.ts`**:
  - Imports: `Canvas, Textbox, Shadow`
  - Instantiation: `new Textbox(...)`, `new Shadow(...)`
- **`PopOnStrategy.ts`**:
  - Imports: `Canvas, Textbox, Shadow`
  - Instantiation: `new Textbox(...)`, `new Shadow(...)`
- **`RollUpStrategy.ts`**:
  - Imports: `Canvas, FabricText, Shadow`
  - Instantiation: `new FabricText(...)`, `new Shadow(...)`
- **`StaticStubStrategy.ts`**:
  - Imports: `Canvas, Textbox, Shadow`
  - Instantiation: `new Textbox(...)`, `new Shadow(...)`
- **`TickerStrategy.ts`**:
  - Imports: `Canvas, FabricText, Rect`
  - Instantiation: `new FabricText(...)`, `new Rect(...)`
- **`TypewriterStrategy.ts`**:
  - Imports: `Canvas, FabricText, Shadow`
  - Instantiation: `new FabricText(...)`, `new Shadow(...)`
- **`WipeStrategy.ts`**:
  - Imports: `Canvas, Textbox, Rect`
  - Instantiation: `new Textbox(...)`, `new Rect(...)` for `clipPath`

---

### 3.2 `apps/render` (Headless Video Frame Renderer)

#### `src/frameRenderer.ts`
- **Entrypoint**: Import from `fabric/node`:
  ```ts
  import { StaticCanvas } from "fabric/node";
  ```
- **Hacks Removal**:
  - Delete `fabric.document` global injection.
  - Delete `jsdomImplForWrapper` extraction hack.
- **Buffer Export**:
  - Use `canvas.toDataURL()` / node-canvas buffer or `canvas.createPNGStream()` / native canvas buffer methods supported by `fabric/node`.

---

### 3.3 `apps/studio` (UI & Web Worker Export)

#### 3.3.1 `src/subtitle/SubtitleEditor.tsx`
- Replace `import { fabric } from "fabric"` with `import { Canvas } from "fabric"`.
- Update `fabricRef` type to `useRef<Canvas | null>(null)`.
- Instantiation: `new Canvas(canvasElRef.current, { ... })`.

#### 3.3.2 `src/export/compositor.ts`
- Replace `import { fabric } from "fabric"` with `import { StaticCanvas, Canvas } from "fabric"`.
- **Remove duplicate `makeFabricCompatible` function** (redundant copy in compositor).
- Update `this.fabricCanvas = new StaticCanvas(this.subtitleCanvas as unknown as HTMLCanvasElement, { ... })`.

#### 3.3.3 `src/export/worker-polyfill.ts`
- Retain the minimal mock DOM environment required by Fabric v7 inside Web Worker contexts (`HTMLCanvasElement`, `HTMLElement`, `Element`, `document`, `window`, `createStyleProxy`, `createClassList`, `makeFabricCompatible`).
- Clean up any dead v5-specific workaround code.

---

## 4. Polyfills & Hacks Removal Summary

| File | Legacy Code to Remove | Rationale |
|---|---|---|
| `packages/engine/src/renderer.ts` | `_setTextStyles` baseline patch (lines 14–47) | Fixed in Fabric v6/v7 core |
| `apps/render/src/frameRenderer.ts` | `(globalThis).document = fabric.document` | Not needed with `fabric/node` |
| `apps/render/src/frameRenderer.ts` | `jsdomImplForWrapper` buffer hack | Clean canvas buffer access in `fabric/node` |
| `apps/studio/src/export/compositor.ts` | `makeFabricCompatible` function (lines 13–42) | Duplicate of `worker-polyfill.ts` |
| All workspaces | `@types/fabric` in `devDependencies` | Built-in TypeScript definitions in `fabric@7` |

---

## 5. Verification & Test Plan

1. **Static Analysis & Types**:
   - Run `turbo run lint` to verify zero TypeScript compiler errors and lint warnings.
2. **Build Verification**:
   - Run `bun run build` across all workspaces to verify client, server, and worker bundles compile without errors.
3. **Interactive UI Testing**:
   - Verify `SubtitleEditor` renders subtitles and that switching animations (Color Fill, Typewriter, Roll-Up, Paint-On, Pop-On, Wipe, Flap Board, Ticker, Digital Matrix) works smoothly.
4. **Client-Side Export Testing**:
   - Test in-browser WebCodecs export in `ExportDialog` to ensure the Web Worker compositor correctly overlays subtitles on video frames.
5. **Headless Render Testing**:
   - Run `bun src/index.ts` in `apps/render` to verify CLI video rendering works with Fabric v7.
