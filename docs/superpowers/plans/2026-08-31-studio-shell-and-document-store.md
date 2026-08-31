# Studio Shell & Document Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `apps/studio`'s hardcoded demo harness with a designed two-column editor shell backed by a selector-subscribed zustand document store with undo/redo.

**Architecture:** One bound zustand store composed of three slices (document / editor / history). The document slice is the only thing undo snapshots; the playhead frame never enters the store and is subscribed in exactly one leaf component. The UI is a sticky player rail plus a tabbed work surface (`Lines ⇄ Style`); the line list doubles as the timeline, so there is no bottom timeline component.

**Tech Stack:** React 19, TanStack Start/Router, Vite 7, Tailwind v4, shadcn (new-york), zustand v5, `@remotion/player` 4.0.515, bun 1.3.4, turbo 2.

**Spec:** `docs/superpowers/specs/2026-08-31-studio-shell-and-document-store-design.md`

## Global Constraints

- **All colors MUST be oklch.** Enforced by the comment contract at the top of `apps/studio/src/styles.css`. No hex, rgb, or hsl in CSS variables.
- **Do not edit anything under `apps/studio/src/components/ui/`.** Those are shadcn-generated. Restyle by remapping semantic CSS variables only.
- **Do not modify `packages/engine` or `apps/render`.** This sub-project is `apps/studio` only.
- **`--border` and `--input` stay alpha-on-white** (`oklch(1 0 0 / 10%)`, `oklch(1 0 0 / 15%)`). Do not remap them to `--hairline`; see spec §10.
- **The playhead frame never enters the zustand store.** Spec §6.2.1.
- **`lines` stays a plain array and updates must preserve object references for untouched lines.** Rows are `React.memo`. Spec §6.2.2.
- **`selectedLineId` lives in the editor slice, never on a line object.** Spec §6.2.3.
- **A unit of subtitle is a "line".** Never "caption", "cue", or "segment". Timecodes are labelled **In** and **Out**. Spec §8.
- **Zero "Fabric.js" references may remain** in `apps/studio/src`. Spec §9.9.
- **The app is titled "Captionly".**
- Package manager is **bun**. Use `bun install`, `bun run`, `bun test` — never npm/npx/pnpm.
- Exact dependency versions to add: `zustand@^5`, `@fontsource-variable/bricolage-grotesque@^5.3.0`, `@fontsource-variable/archivo@^5.3.0`, `@fontsource/ibm-plex-mono@^5.3.0` (static only — no variable build exists).
- Font family strings: `"Bricolage Grotesque Variable"`, `"Archivo Variable"`, `"IBM Plex Mono"`. Every stack ends in a real fallback.
- Line block height clamps to **72–200px**; a gap void clamps to **24–120px**. Scale factor **28px per second**.
- Timecode format is **`M:SS.cc`**, extending to `H:MM:SS.cc` only past one hour.
- Undo coalescing window is **600ms**; `past` caps at **100** entries.
- Both microinteractions must respect `prefers-reduced-motion: reduce` by degrading to opacity-only.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `src/lib/constants.ts` | `FPS`. Shared by the rail, list, and playhead. |
| `src/lib/timecode.ts` | Format/parse `M:SS.cc`. Pure. |
| `src/lib/timecode.test.ts` | Timecode edge cases. |
| `src/lib/useCurrentPlayerFrame.ts` | `useSyncExternalStore` wrapper over the player's `frameupdate` event. Not exported by Remotion — hand-written per their recipe. |
| `src/store/types.ts` | `DocumentSnapshot`, `HistoryEntry`, slice interfaces. |
| `src/store/documentSlice.ts` | Video meta, lines, style, animation, position. |
| `src/store/editorSlice.ts` | Selection, edit target, active tab. Not undoable. |
| `src/store/historySlice.ts` | Snapshot undo/redo with coalescing. |
| `src/store/historySlice.test.ts` | **Required by spec §9.** Coalescing rules. |
| `src/store/fixture.ts` | SP1 seed. **Deleted in sub-project 2.** |
| `src/store/index.ts` | `create<Doc & Editor & History>()`. |
| `src/app/StudioShell.tsx` | Two-column frame + header. |
| `src/app/PlayerRail.tsx` | Sticky rail: player, transport, aspect, safe zone. |
| `src/app/WorkSurface.tsx` | `Tabs`: Lines \| Style. |
| `src/lines/geometry.ts` | Duration → clamped pixel height. Pure. |
| `src/lines/LineList.tsx` | Scroll container; maps to memoized rows. |
| `src/lines/LineRow.tsx` | One line block. `React.memo`. |
| `src/lines/Interstitial.tsx` | Boundary: hairline or labelled void. Visual only in SP1. |
| `src/lines/WordStrip.tsx` | Duration-proportional word chips. |
| `src/lines/RulerGutter.tsx` | Left spotting ruler. |
| `src/lines/Playhead.tsx` | **The only frame subscriber.** |

**Modified:** `package.json`, `src/styles.css`, `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/subtitle/StylePanel.tsx`, `src/subtitle/StudioPlayer.tsx`.

**Deleted:** `src/subtitle/useStudioPlayer.ts` (411), `src/subtitle/VideoControls.tsx` (287), `src/subtitle/SubtitleEditor.tsx` (88).

---

## Task 1: Dependencies & Design Tokens

Root `node_modules/` currently contains only `turbo` — workspace dependencies are not installed. This task installs them and lands the visual identity.

**Files:**
- Modify: `apps/studio/package.json`
- Modify: `apps/studio/src/styles.css`
- Modify: `apps/studio/src/routes/__root.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: Tailwind utilities `bg-void bg-surface bg-raised border-hairline text-now text-edit text-ink text-ink-muted`, and `font-display font-sans font-mono`. Dark theme active on `<html>`.

- [ ] **Step 1: Install workspace dependencies**

```bash
cd /Users/video/Desktop/captionly && bun install
```

Expected: completes, `apps/studio/node_modules` or root `node_modules` populated with react, vite, @remotion/player.

- [ ] **Step 2: Add the new dependencies**

```bash
cd /Users/video/Desktop/captionly/apps/studio && bun add zustand@^5 @fontsource-variable/bricolage-grotesque@^5.3.0 @fontsource-variable/archivo@^5.3.0 @fontsource/ibm-plex-mono@^5.3.0
```

- [ ] **Step 3: Add a test script**

In `apps/studio/package.json`, add to `"scripts"`:

```json
"test": "bun test"
```

- [ ] **Step 4: Add font imports at the very top of `styles.css`**

CSS requires all `@import` before other rules. These four lines go **above** the existing `@import "tailwindcss"`:

```css
@import "@fontsource-variable/bricolage-grotesque";
@import "@fontsource-variable/archivo";
@import "@fontsource/ibm-plex-mono/400.css";
@import "@fontsource/ibm-plex-mono/500.css";
@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";
```

- [ ] **Step 5: Register tokens in the `@theme inline` block**

Add these inside the existing `@theme inline { ... }`, after the radius lines:

```css
  --font-display: "Bricolage Grotesque Variable", system-ui, sans-serif;
  --font-sans: "Archivo Variable", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, monospace;
  --color-void: var(--void);
  --color-surface: var(--surface);
  --color-raised: var(--raised);
  --color-hairline: var(--hairline);
  --color-now: var(--now);
  --color-edit: var(--edit);
  --color-ink: var(--ink);
  --color-ink-muted: var(--ink-muted);
```

- [ ] **Step 6: Add the palette to `:root`**

Add inside the existing `:root { ... }` block. These are the verified oklch conversions from spec §4.2:

```css
  --void: oklch(0.1593 0.0111 267.98);
  --surface: oklch(0.1964 0.0168 268.77);
  --raised: oklch(0.2394 0.0225 265.67);
  --hairline: oklch(0.2891 0.0254 265.46);
  --now: oklch(0.7819 0.1585 72.33);
  --edit: oklch(0.6569 0.1758 286.11);
  --ink: oklch(0.9372 0.0084 271.33);
  --ink-muted: oklch(0.6635 0.0311 268.21);
```

- [ ] **Step 7: Remap the shadcn dark variables**

Replace these lines **inside the existing `.dark { ... }` block**. Leave every other line in `.dark` untouched — in particular `--border` and `--input` keep their alpha-on-white values:

```css
  --background: var(--void);
  --foreground: var(--ink);
  --card: var(--surface);
  --card-foreground: var(--ink);
  --popover: var(--surface);
  --popover-foreground: var(--ink);
  --primary: var(--edit);
  --primary-foreground: oklch(0.9842 0.003 247.858);
  --secondary: var(--raised);
  --secondary-foreground: var(--ink);
  --muted: var(--raised);
  --muted-foreground: var(--ink-muted);
  --accent: var(--raised);
  --accent-foreground: var(--ink);
  --ring: var(--edit);
```

- [ ] **Step 8: Set the base font and reduced-motion guard**

Replace the existing `@layer base { ... }` block with:

```css
@layer base {
  * {
    border-color: var(--color-border);
  }

  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
  }

  .tabular {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

- [ ] **Step 9: Make dark the default theme**

In `src/routes/__root.tsx`, in `RootShell`, change the opening html tag to:

```tsx
    <html lang="en" className="dark">
```

- [ ] **Step 10: Fix the stale metadata**

In `src/routes/__root.tsx`, replace the three stale strings in the `head()` meta array:

```tsx
      { title: "Captionly — Subtitle Spotting Studio" },
      {
        name: "description",
        content:
          "Type subtitle lines against your video, spot their timings, and style animated captions.",
      },
      { property: "og:title", content: "Captionly" },
      {
        property: "og:description",
        content:
          "Type subtitle lines against your video, spot their timings, and style animated captions.",
      },
```

- [ ] **Step 11: Verify the build**

```bash
cd /Users/video/Desktop/captionly && bun run build:frontend
```

Expected: build succeeds. A failure naming `@fontsource-variable/...` means a package name is wrong — re-check Step 2.

- [ ] **Step 12: Commit**

```bash
git add apps/studio/package.json apps/studio/src/styles.css apps/studio/src/routes/__root.tsx bun.lock
git commit -m "feat(studio): add design tokens, self-hosted fonts, dark default"
```

---

## Task 2: Timecode Utility

**Files:**
- Create: `apps/studio/src/lib/constants.ts`
- Create: `apps/studio/src/lib/timecode.ts`
- Test: `apps/studio/src/lib/timecode.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `FPS`, `formatTimecode(seconds: number): string`, `parseTimecode(input: string): number | null`.

- [ ] **Step 0: Create the shared constant**

`FPS` is consumed by `PlayerRail`, `LineList`, and `Playhead`. It lives in its own module so those three do not have to import from each other.

Create `apps/studio/src/lib/constants.ts`:

```ts
/** Composition frame rate. Subtitle timings are in seconds and Remotion's
 *  <Video> syncs by time, so this sets animation granularity and export
 *  frame rate only — it does not need to match the source file's fps. */
export const FPS = 30;
```

- [ ] **Step 1: Write the failing test**

Create `apps/studio/src/lib/timecode.test.ts`:

```ts
import { test, expect } from "bun:test";
import { formatTimecode, parseTimecode } from "./timecode";

test("formats seconds as M:SS.cc", () => {
  expect(formatTimecode(0)).toBe("0:00.00");
  expect(formatTimecode(8.4)).toBe("0:08.40");
  expect(formatTimecode(65.25)).toBe("1:05.25");
});

test("rounds centiseconds without leaking into the seconds field", () => {
  // 9.999 must not render as "0:9.100"
  expect(formatTimecode(9.999)).toBe("0:10.00");
  expect(formatTimecode(59.999)).toBe("1:00.00");
});

test("extends to H:MM:SS.cc past one hour", () => {
  expect(formatTimecode(3600)).toBe("1:00:00.00");
  expect(formatTimecode(3661.5)).toBe("1:01:01.50");
});

test("clamps negatives to zero", () => {
  expect(formatTimecode(-1)).toBe("0:00.00");
});

test("parses what it formats", () => {
  for (const s of [0, 8.4, 65.25, 3661.5]) {
    expect(parseTimecode(formatTimecode(s))).toBeCloseTo(s, 2);
  }
});

test("rejects malformed input", () => {
  expect(parseTimecode("")).toBeNull();
  expect(parseTimecode("abc")).toBeNull();
  expect(parseTimecode("1:2:3:4.00")).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/video/Desktop/captionly/apps/studio && bun test src/lib/timecode.test.ts
```

Expected: FAIL — cannot resolve `./timecode`.

- [ ] **Step 3: Write the implementation**

Create `apps/studio/src/lib/timecode.ts`:

```ts
/** Formats seconds as M:SS.cc, extending to H:MM:SS.cc past one hour. */
export function formatTimecode(seconds: number): string {
  const total = Math.max(0, Math.round(seconds * 100)); // centiseconds
  const cc = total % 100;
  const totalSec = (total - cc) / 100;
  const ss = totalSec % 60;
  const totalMin = (totalSec - ss) / 60;
  const mm = totalMin % 60;
  const hh = (totalMin - mm) / 60;

  const p = (n: number) => String(n).padStart(2, "0");
  return hh > 0 ? `${hh}:${p(mm)}:${p(ss)}.${p(cc)}` : `${mm}:${p(ss)}.${p(cc)}`;
}

/** Parses M:SS.cc or H:MM:SS.cc. Returns null when the input is not a timecode. */
export function parseTimecode(input: string): number | null {
  const m = input.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const [, h, a, b, cs] = m;
  const hours = h ? Number(h) : 0;
  const mins = Number(a);
  const secs = Number(b);
  if (secs > 59 || (h && mins > 59)) return null;
  const centis = cs ? Number(cs.padEnd(2, "0")) : 0;
  return hours * 3600 + mins * 60 + secs + centis / 100;
}
```

> Rounding to centiseconds happens **first**, then all fields derive from that integer. Deriving each field independently from the float is what produces `0:9.100`.

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /Users/video/Desktop/captionly/apps/studio && bun test src/lib/timecode.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/lib/timecode.ts apps/studio/src/lib/timecode.test.ts
git commit -m "feat(studio): add timecode format and parse helpers"
```

---

## Task 3: Document & Editor Slices

**Files:**
- Create: `apps/studio/src/store/types.ts`
- Create: `apps/studio/src/store/documentSlice.ts`
- Create: `apps/studio/src/store/editorSlice.ts`
- Create: `apps/studio/src/store/fixture.ts`

**Interfaces:**
- Consumes: `@captionly/engine` types (`SubtitleLine`, `SubtitleStyle`, `SubtitlePosition`, `AnimationConfig`), `sampleSubtitles`, `defaultStyle`, `defaultPosition`, `defaultAnimation`.
- Produces: `DocumentSlice`, `EditorSlice`, `DocumentSnapshot`, `VideoMeta`, `createDocumentSlice`, `createEditorSlice`, `SP1_FIXTURE`.

- [ ] **Step 1: Create the shared types**

Create `apps/studio/src/store/types.ts`:

```ts
import type {
  SubtitleLine,
  SubtitleStyle,
  SubtitlePosition,
  AnimationConfig,
} from "@captionly/engine";

export interface VideoMeta {
  src: string;
  durationSec: number;
  width: number;
  height: number;
}

/** The serializable document. Undo snapshots this and only this. */
export interface DocumentSnapshot {
  video: VideoMeta | null;
  lines: SubtitleLine[];
  style: SubtitleStyle;
  animation: AnimationConfig;
  position: SubtitlePosition;
}

export interface DocumentSlice extends DocumentSnapshot {
  setStyle: (patch: Partial<SubtitleStyle>) => void;
  setAnimation: (a: AnimationConfig) => void;
  setPosition: (p: SubtitlePosition) => void;
  /** Used by history to restore. Does not itself record history. */
  replaceDocument: (doc: DocumentSnapshot) => void;
}

export type WorkTab = "lines" | "style";

export interface EditorSlice {
  selectedLineId: string | null;
  editingLineId: string | null;
  activeTab: WorkTab;
  select: (id: string | null) => void;
  beginEdit: (id: string) => void;
  endEdit: () => void;
  setTab: (t: WorkTab) => void;
}

export interface HistoryEntry {
  snapshot: DocumentSnapshot;
  label: string;
  /** e.g. `text:${lineId}`. Absent for discrete actions, which never coalesce. */
  coalesceKey?: string;
  at: number;
}

export interface HistorySlice {
  past: HistoryEntry[];
  future: HistoryEntry[];
  commit: (label: string, opts?: { coalesceKey?: string }) => void;
  undo: () => void;
  redo: () => void;
}

export type StudioState = DocumentSlice & EditorSlice & HistorySlice;
```

- [ ] **Step 2: Create the sub-project 1 fixture**

Create `apps/studio/src/store/fixture.ts`. These values are relocated verbatim from the constants currently in `SubtitleEditor.tsx`:

```ts
import {
  sampleSubtitles,
  defaultStyle,
  defaultPosition,
  defaultAnimation,
} from "@captionly/engine";
import type { DocumentSnapshot } from "./types";

/**
 * Sub-project 1 seed. Upload lands in sub-project 2, but PlayerRail's transport,
 * LineList's trailing affordance, and <Player durationInFrames> all need a
 * duration before then.
 *
 * DELETE THIS FILE in sub-project 2, when real metadata arrives from
 * the video element's `loadedmetadata` event.
 */
export const SP1_FIXTURE: DocumentSnapshot = {
  video: { src: "/test1.mp4", durationSec: 15, width: 1920, height: 1080 },
  lines: sampleSubtitles,
  style: defaultStyle,
  animation: defaultAnimation,
  position: defaultPosition,
};
```

- [ ] **Step 3: Create the document slice**

Create `apps/studio/src/store/documentSlice.ts`:

```ts
import type { StateCreator } from "zustand";
import type { DocumentSlice, StudioState } from "./types";
import { SP1_FIXTURE } from "./fixture";

export const createDocumentSlice: StateCreator<
  StudioState,
  [],
  [],
  DocumentSlice
> = (set) => ({
  ...SP1_FIXTURE,

  setStyle: (patch) => set((s) => ({ style: { ...s.style, ...patch } })),
  setAnimation: (animation) => set({ animation }),
  setPosition: (position) => set({ position }),
  replaceDocument: (doc) => set({ ...doc }),
});
```

- [ ] **Step 4: Create the editor slice**

Create `apps/studio/src/store/editorSlice.ts`:

```ts
import type { StateCreator } from "zustand";
import type { EditorSlice, StudioState } from "./types";

export const createEditorSlice: StateCreator<
  StudioState,
  [],
  [],
  EditorSlice
> = (set) => ({
  selectedLineId: null,
  editingLineId: null,
  activeTab: "lines",

  select: (selectedLineId) => set({ selectedLineId }),
  beginEdit: (id) => set({ editingLineId: id, selectedLineId: id }),
  endEdit: () => set({ editingLineId: null }),
  setTab: (activeTab) => set({ activeTab }),
});
```

> `select` sets only `selectedLineId`. It must never touch `lines`, or every row's object reference changes and the `React.memo` optimisation in Task 7 stops working.

- [ ] **Step 5: Typecheck**

```bash
cd /Users/video/Desktop/captionly/apps/studio && bunx tsc --noEmit
```

Expected: no errors from `src/store/`. Errors elsewhere are pre-existing; note them but do not fix here.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/store/
git commit -m "feat(studio): add document and editor store slices"
```

---

## Task 4: History Slice with Coalescing

The one piece of automated-test-required logic in this sub-project (spec §9). A broken coalescing window fails silently — it just quietly makes undo useless.

**Files:**
- Create: `apps/studio/src/store/historySlice.ts`
- Create: `apps/studio/src/store/index.ts`
- Test: `apps/studio/src/store/historySlice.test.ts`

**Interfaces:**
- Consumes: `StudioState`, `DocumentSnapshot`, `HistoryEntry` from Task 3.
- Produces: `createHistorySlice`, `useStudioStore`, `MAX_HISTORY = 100`, `COALESCE_MS = 600`.

- [ ] **Step 1: Write the failing test**

Create `apps/studio/src/store/historySlice.test.ts`:

```ts
import { test, expect, beforeEach } from "bun:test";
import { useStudioStore, COALESCE_MS, MAX_HISTORY } from "./index";
import { SP1_FIXTURE } from "./fixture";

const reset = () =>
  useStudioStore.setState({ ...SP1_FIXTURE, past: [], future: [] });

beforeEach(reset);

const s = () => useStudioStore.getState();

test("a discrete action pushes one entry and clears future", () => {
  s().commit("Set style");
  s().setStyle({ fontSize: 90 });
  expect(s().past.length).toBe(1);

  s().undo();
  expect(s().future.length).toBe(1);

  s().commit("Set style");
  expect(s().future.length).toBe(0);
});

test("two text edits to the same line within the window produce one entry", () => {
  s().commit("Edit line", { coalesceKey: "text:line-1" });
  s().commit("Edit line", { coalesceKey: "text:line-1" });
  expect(s().past.length).toBe(1);
});

test("text edits to different lines within the window produce two entries", () => {
  s().commit("Edit line", { coalesceKey: "text:line-1" });
  s().commit("Edit line", { coalesceKey: "text:line-2" });
  expect(s().past.length).toBe(2);
});

test("text edits to the same line outside the window produce two entries", async () => {
  s().commit("Edit line", { coalesceKey: "text:line-1" });
  useStudioStore.setState((st) => ({
    past: st.past.map((e) => ({ ...e, at: e.at - COALESCE_MS - 1 })),
  }));
  s().commit("Edit line", { coalesceKey: "text:line-1" });
  expect(s().past.length).toBe(2);
});

test("discrete actions never coalesce with each other", () => {
  s().commit("Delete line");
  s().commit("Delete line");
  expect(s().past.length).toBe(2);
});

test("coalescing keeps the OLDER snapshot", () => {
  useStudioStore.setState({ style: { ...s().style, fontSize: 10 } });
  s().commit("Edit line", { coalesceKey: "text:line-1" });
  useStudioStore.setState({ style: { ...s().style, fontSize: 20 } });
  s().commit("Edit line", { coalesceKey: "text:line-1" });

  expect(s().past.length).toBe(1);
  // Undo must return to before the typing burst began, not to its middle.
  expect(s().past[0].snapshot.style.fontSize).toBe(10);
});

test("past never exceeds MAX_HISTORY, dropping oldest first", () => {
  for (let i = 0; i < MAX_HISTORY + 20; i++) s().commit(`Action ${i}`);
  expect(s().past.length).toBe(MAX_HISTORY);
  expect(s().past[s().past.length - 1].label).toBe(`Action ${MAX_HISTORY + 19}`);
});

test("undo restores the document and redo reapplies it", () => {
  s().setStyle({ fontSize: 42 });
  s().commit("Set style");
  s().setStyle({ fontSize: 99 });

  s().undo();
  expect(s().style.fontSize).toBe(42);

  s().redo();
  expect(s().style.fontSize).toBe(99);
});

test("undo on empty history is a no-op", () => {
  expect(() => s().undo()).not.toThrow();
  expect(s().past.length).toBe(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/video/Desktop/captionly/apps/studio && bun test src/store/historySlice.test.ts
```

Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Write the history slice**

Create `apps/studio/src/store/historySlice.ts`:

```ts
import type { StateCreator } from "zustand";
import type { DocumentSnapshot, HistorySlice, StudioState } from "./types";

export const MAX_HISTORY = 100;
export const COALESCE_MS = 600;

function snapshot(s: StudioState): DocumentSnapshot {
  return {
    video: s.video,
    lines: s.lines,
    style: s.style,
    animation: s.animation,
    position: s.position,
  };
}

export const createHistorySlice: StateCreator<
  StudioState,
  [],
  [],
  HistorySlice
> = (set, get) => ({
  past: [],
  future: [],

  commit: (label, opts) => {
    const state = get();
    const entry = {
      snapshot: snapshot(state),
      label,
      coalesceKey: opts?.coalesceKey,
      at: Date.now(),
    };

    const top = state.past[state.past.length - 1];
    const coalesces =
      entry.coalesceKey !== undefined &&
      top?.coalesceKey === entry.coalesceKey &&
      entry.at - top.at < COALESCE_MS;

    if (coalesces) {
      // Keep the OLDER snapshot; refresh only the timestamp so a continuous
      // burst of typing keeps extending the same window.
      const past = state.past.slice(0, -1);
      past.push({ ...top, at: entry.at });
      set({ past, future: [] });
      return;
    }

    const past = [...state.past, entry];
    if (past.length > MAX_HISTORY) past.splice(0, past.length - MAX_HISTORY);
    set({ past, future: [] });
  },

  undo: () => {
    const state = get();
    const top = state.past[state.past.length - 1];
    if (!top) return;
    set({
      past: state.past.slice(0, -1),
      future: [
        ...state.future,
        { snapshot: snapshot(state), label: top.label, at: Date.now() },
      ],
    });
    state.replaceDocument(top.snapshot);
  },

  redo: () => {
    const state = get();
    const top = state.future[state.future.length - 1];
    if (!top) return;
    set({
      future: state.future.slice(0, -1),
      past: [
        ...state.past,
        { snapshot: snapshot(state), label: top.label, at: Date.now() },
      ],
    });
    state.replaceDocument(top.snapshot);
  },
});
```

- [ ] **Step 4: Create the bound store**

Create `apps/studio/src/store/index.ts`:

```ts
import { create } from "zustand";
import type { StudioState } from "./types";
import { createDocumentSlice } from "./documentSlice";
import { createEditorSlice } from "./editorSlice";
import { createHistorySlice } from "./historySlice";

export const useStudioStore = create<StudioState>()((...a) => ({
  ...createDocumentSlice(...a),
  ...createEditorSlice(...a),
  ...createHistorySlice(...a),
}));

export { MAX_HISTORY, COALESCE_MS } from "./historySlice";
export type * from "./types";
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd /Users/video/Desktop/captionly/apps/studio && bun test src/store/historySlice.test.ts
```

Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/store/
git commit -m "feat(studio): add snapshot history with edit coalescing"
```

---

## Task 5: Player Frame Hook

`useCurrentPlayerFrame` is **not exported** by `@remotion/player`. It is a documented recipe (remotion.dev/docs/player/current-time) that must be hand-written.

**Files:**
- Create: `apps/studio/src/lib/useCurrentPlayerFrame.ts`

**Interfaces:**
- Consumes: `PlayerRef`, `CallbackListener` from `@remotion/player`.
- Produces: `useCurrentPlayerFrame(ref: React.RefObject<PlayerRef | null>): number`.

- [ ] **Step 1: Write the hook**

Create `apps/studio/src/lib/useCurrentPlayerFrame.ts`:

```ts
import type { CallbackListener, PlayerRef } from "@remotion/player";
import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to the player's current frame.
 *
 * Call this in ONE leaf component only (Playhead). It fires on every frame;
 * calling it higher in the tree re-renders the whole editor at fps.
 * The frame must never be written into the zustand store — see spec §6.2.1.
 */
export function useCurrentPlayerFrame(
  ref: React.RefObject<PlayerRef | null>,
): number {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const { current } = ref;
      if (!current) return () => undefined;

      const updater: CallbackListener<"frameupdate"> = () => onStoreChange();
      current.addEventListener("frameupdate", updater);
      return () => current.removeEventListener("frameupdate", updater);
    },
    [ref],
  );

  return useSyncExternalStore<number>(
    subscribe,
    () => ref.current?.getCurrentFrame() ?? 0,
    () => 0,
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/video/Desktop/captionly/apps/studio && bunx tsc --noEmit
```

Expected: no errors in `src/lib/useCurrentPlayerFrame.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/studio/src/lib/useCurrentPlayerFrame.ts
git commit -m "feat(studio): add useCurrentPlayerFrame subscription hook"
```

---

## Task 6: Shell, Player Rail & Dead Code Removal

Replaces `SubtitleEditor` with the two-column frame. After this task the app runs on the store.

**Files:**
- Create: `apps/studio/src/app/StudioShell.tsx`
- Create: `apps/studio/src/app/PlayerRail.tsx`
- Create: `apps/studio/src/app/WorkSurface.tsx`
- Modify: `apps/studio/src/routes/index.tsx`
- Modify: `apps/studio/src/subtitle/StudioPlayer.tsx`
- Modify: `apps/studio/src/subtitle/StylePanel.tsx`
- Delete: `apps/studio/src/subtitle/useStudioPlayer.ts`, `VideoControls.tsx`, `SubtitleEditor.tsx`

**Interfaces:**
- Consumes: `useStudioStore` (Task 4), `formatTimecode` (Task 2).
- Produces: `StudioShell`, `PlayerRail`, `WorkSurface`. `StudioShell` owns the shared `playerRef` and passes it to both children.

- [ ] **Step 1: Delete the dead code**

```bash
cd /Users/video/Desktop/captionly && git rm apps/studio/src/subtitle/useStudioPlayer.ts apps/studio/src/subtitle/VideoControls.tsx apps/studio/src/subtitle/SubtitleEditor.tsx
```

> Do **not** adapt `VideoControls.tsx` into the transport. It drives an `HTMLVideoElement` through `videoRef`; the Remotion player is controlled via `playerRef.current.seekTo(frame)`. Different API, different units.

- [ ] **Step 2: Make StudioPlayer store-driven**

In `apps/studio/src/subtitle/StudioPlayer.tsx`, replace the hardcoded composition size and remove the built-in controls (the rail provides transport). Change the `<Player>` props to:

```tsx
      <Player
        ref={playerRef}
        component={MainComposition}
        inputProps={{ videoSrc, subtitles }}
        durationInFrames={durationInFrames}
        compositionWidth={compositionWidth}
        compositionHeight={compositionHeight}
        fps={fps}
        loop
        className="w-full h-full"
        style={{ width: "100%", height: "100%" }}
      />
```

And widen the props interface — add these two, keeping the existing ones:

```tsx
  compositionWidth: number;
  compositionHeight: number;
```

Remove `compositionWidth = 1920` / `compositionHeight = 1080` literals and the `controls` prop from the JSX.

- [ ] **Step 3: Remove the false affordance text**

In `apps/studio/src/subtitle/StylePanel.tsx`, replace the subtitle paragraph:

```tsx
        <p className="text-xs text-ink-muted mt-1">
          Applies to every line in the project.
        </p>
```

- [ ] **Step 4: Create the player rail**

Create `apps/studio/src/app/PlayerRail.tsx`:

```tsx
import type { PlayerRef } from "@remotion/player";
import { Play, Pause } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useStudioStore } from "@/store";
import { StudioPlayer } from "@/subtitle/StudioPlayer";
import { formatTimecode } from "@/lib/timecode";
import { FPS } from "@/lib/constants";
import type { SafeZonePreset } from "@captionly/engine";

export function PlayerRail({
  playerRef,
  safeZone,
  onSafeZoneChange,
}: {
  playerRef: React.RefObject<PlayerRef | null>;
  safeZone: SafeZonePreset;
  onSafeZoneChange: (z: SafeZonePreset) => void;
}) {
  const { video, lines, style, animation, position } = useStudioStore(
    useShallow((s) => ({
      video: s.video,
      lines: s.lines,
      style: s.style,
      animation: s.animation,
      position: s.position,
    })),
  );
  const [playing, setPlaying] = useState(false);

  // Track play state from the player's own events. Do NOT derive it by calling
  // isPlaying() right after play()/pause() — the call races the state change.
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    setPlaying(p.isPlaying());
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    return () => {
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
    };
  }, [playerRef]);

  const toggle = useCallback(() => playerRef.current?.toggle(), [playerRef]);

  // Guard on null now, so sub-project 2 can drop the fixture without
  // reintroducing durationInFrames={0}.
  if (!video) {
    return (
      <aside className="flex items-center justify-center rounded-xl border border-hairline bg-surface p-8">
        <p className="font-display text-sm text-ink-muted">No video loaded.</p>
      </aside>
    );
  }

  const aspect = video.width / video.height;

  return (
    <aside
      className="flex flex-col gap-4 self-start sticky top-6"
      style={{ width: `clamp(280px, ${aspect >= 1 ? "42vw" : "24vw"}, 640px)` }}
    >
      <div style={{ aspectRatio: String(aspect) }}>
        <StudioPlayer
          videoSrc={video.src}
          subtitles={{ lines, style, position, animation }}
          safeZone={safeZone}
          durationInFrames={Math.round(video.durationSec * FPS)}
          compositionWidth={video.width}
          compositionHeight={video.height}
          fps={FPS}
          playerRef={playerRef}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="grid h-9 w-9 place-items-center rounded-full bg-edit text-void
                     transition-transform hover:scale-105 active:scale-95
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <span className="tabular text-xs text-ink-muted">
          {formatTimecode(video.durationSec)}
        </span>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-ink-muted">
          Safe zone
        </span>
        <select
          value={safeZone}
          onChange={(e) => onSafeZoneChange(e.target.value as SafeZonePreset)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
        >
          <option value="none">None</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
          <option value="youtube">YouTube</option>
        </select>
      </label>
    </aside>
  );
}
```

- [ ] **Step 5: Create the work surface**

Create `apps/studio/src/app/WorkSurface.tsx`:

```tsx
import type { PlayerRef } from "@remotion/player";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useStudioStore } from "@/store";
import { StylePanel } from "@/subtitle/StylePanel";
import { AnimationPanel } from "@/subtitle/AnimationPanel";
import { LineList } from "@/lines/LineList";
import type { SafeZonePreset } from "@captionly/engine";

export function WorkSurface({
  playerRef,
  safeZone,
  onSafeZoneChange,
}: {
  playerRef: React.RefObject<PlayerRef | null>;
  safeZone: SafeZonePreset;
  onSafeZoneChange: (z: SafeZonePreset) => void;
}) {
  const activeTab = useStudioStore((s) => s.activeTab);
  const setTab = useStudioStore((s) => s.setTab);
  const style = useStudioStore((s) => s.style);
  const setStyle = useStudioStore((s) => s.setStyle);
  const animation = useStudioStore((s) => s.animation);
  const setAnimation = useStudioStore((s) => s.setAnimation);
  const lineCount = useStudioStore((s) => s.lines.length);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setTab(v as "lines" | "style")}
      className="min-w-0 flex-1"
    >
      <div className="mb-4 flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="lines">Lines</TabsTrigger>
          <TabsTrigger value="style">Style</TabsTrigger>
        </TabsList>
        <span className="tabular text-xs text-ink-muted">{lineCount} lines</span>
      </div>

      <TabsContent value="lines">
        <LineList playerRef={playerRef} />
      </TabsContent>

      <TabsContent value="style" className="flex flex-col gap-4">
        <AnimationPanel animation={animation} onChange={setAnimation} />
        <StylePanel
          style={style}
          onStyleChange={(s) => setStyle(s)}
          safeZone={safeZone}
          onSafeZoneChange={onSafeZoneChange}
        />
      </TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 6: Create the shell**

Create `apps/studio/src/app/StudioShell.tsx`:

```tsx
import { useRef, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import { Download, Undo2, Redo2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useStudioStore } from "@/store";
import { ExportDialog } from "@/export/ExportDialog";
import { PlayerRail } from "./PlayerRail";
import { WorkSurface } from "./WorkSurface";
import { formatTimecode } from "@/lib/timecode";
import type { SafeZonePreset } from "@captionly/engine";

export function StudioShell() {
  const playerRef = useRef<PlayerRef | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [safeZone, setSafeZone] = useState<SafeZonePreset>("none");

  const { video, lines, style, animation, position } = useStudioStore(
    useShallow((s) => ({
      video: s.video,
      lines: s.lines,
      style: s.style,
      animation: s.animation,
      position: s.position,
    })),
  );
  const canUndo = useStudioStore((s) => s.past.length > 0);
  const canRedo = useStudioStore((s) => s.future.length > 0);
  const undo = useStudioStore((s) => s.undo);
  const redo = useStudioStore((s) => s.redo);

  return (
    <div className="min-h-screen bg-void text-ink">
      <header className="sticky top-0 z-30 border-b border-hairline bg-void/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-lg font-semibold tracking-tight">
              Captionly
            </span>
            {video && (
              <span className="tabular text-xs text-ink-muted">
                {video.src.split("/").pop()} · {video.width}×{video.height} ·{" "}
                {formatTimecode(video.durationSec)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={undo}
              disabled={!canUndo}
              aria-label="Undo"
              className="grid h-8 w-8 place-items-center rounded-md text-ink-muted
                         transition-colors hover:bg-raised hover:text-ink disabled:opacity-30
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              aria-label="Redo"
              className="grid h-8 w-8 place-items-center rounded-md text-ink-muted
                         transition-colors hover:bg-raised hover:text-ink disabled:opacity-30
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit"
            >
              <Redo2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setExportOpen(true)}
              className="flex items-center gap-2 rounded-md bg-edit px-3 py-1.5 text-xs
                         font-semibold text-void transition-transform hover:scale-[1.02]
                         active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2
                         focus-visible:outline-edit"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] items-start gap-8 px-6 py-6">
        <PlayerRail
          playerRef={playerRef}
          safeZone={safeZone}
          onSafeZoneChange={setSafeZone}
        />
        <WorkSurface
          playerRef={playerRef}
          safeZone={safeZone}
          onSafeZoneChange={setSafeZone}
        />
      </div>

      {video && (
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          videoSrc={video.src}
          subtitles={{ lines, style, position, animation }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Reduce the route to a route definition**

Replace the entire contents of `apps/studio/src/routes/index.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { StudioShell } from "@/app/StudioShell";

export const Route = createFileRoute("/")({
  component: StudioShell,
  head: () => ({
    meta: [
      { title: "Captionly — Subtitle Spotting Studio" },
      {
        name: "description",
        content:
          "Type subtitle lines against your video, spot their timings, and style animated captions.",
      },
    ],
  }),
});
```

- [ ] **Step 8: Verify no Fabric references remain**

```bash
cd /Users/video/Desktop/captionly && grep -ri "fabric" apps/studio/src || echo "CLEAN"
```

Expected: `CLEAN`.

- [ ] **Step 9: Commit**

Task 7 creates `LineList`, which this task imports — the build will not pass until then. Commit the structural change now and verify at the end of Task 7.

```bash
git add -A apps/studio/src
git commit -m "feat(studio): add two-column shell, remove dead player code"
```

---

## Task 7: Line List, Rows, Ruler & Interstitials

**Files:**
- Create: `apps/studio/src/lines/geometry.ts`
- Create: `apps/studio/src/lines/LineList.tsx`
- Create: `apps/studio/src/lines/LineRow.tsx`
- Create: `apps/studio/src/lines/Interstitial.tsx`
- Create: `apps/studio/src/lines/RulerGutter.tsx`

**Interfaces:**
- Consumes: `useStudioStore`, `formatTimecode`, `SubtitleLine`.
- Produces: `LineList({ playerRef })`, `lineHeight(durationSec)`, `voidHeight(gapSec)`, `PX_PER_SEC`.

- [ ] **Step 1: Create the geometry helpers**

Create `apps/studio/src/lines/geometry.ts`:

```ts
export const PX_PER_SEC = 28;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Line blocks are proportional to duration but clamped, so a long line
 *  stays legible and a 10-minute video is not a scroll marathon. */
export const lineHeight = (durationSec: number) =>
  clamp(durationSec * PX_PER_SEC, 72, 200);

/** Gaps render as voids sized to their duration, clamped tighter than lines. */
export const voidHeight = (gapSec: number) =>
  clamp(gapSec * PX_PER_SEC, 24, 120);
```

- [ ] **Step 2: Create the ruler gutter**

Create `apps/studio/src/lines/RulerGutter.tsx`:

```tsx
/** The spotting ruler: a vertical mark whose weight encodes row state. */
export function RulerGutter({ selected }: { selected: boolean }) {
  return (
    <div
      aria-hidden
      className={`w-px shrink-0 rounded-full transition-colors ${
        selected ? "w-[3px] bg-edit" : "bg-hairline"
      }`}
    />
  );
}
```

- [ ] **Step 3: Create the interstitial**

Create `apps/studio/src/lines/Interstitial.tsx`:

```tsx
import { voidHeight } from "./geometry";

/**
 * The boundary between two lines. A butt joint renders as a hairline; a gap
 * renders as a labelled dashed void sized to its duration.
 *
 * Sub-project 1 is VISUAL ONLY. The "Merge lines" and "Add line" controls
 * this hosts arrive in sub-project 3.
 */
export function Interstitial({ gapSec }: { gapSec: number }) {
  if (gapSec <= 0.001) {
    return <div aria-hidden className="ml-6 h-px bg-hairline" />;
  }

  return (
    <div
      className="ml-6 flex items-center justify-center rounded-sm border border-dashed border-hairline"
      style={{ height: voidHeight(gapSec) }}
    >
      <span className="tabular text-[0.6875rem] text-ink-muted">
        {gapSec.toFixed(2)}s free
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Create the row**

Create `apps/studio/src/lines/LineRow.tsx`:

```tsx
import { memo } from "react";
import type { SubtitleLine } from "@captionly/engine";
import { formatTimecode } from "@/lib/timecode";
import { lineHeight } from "./geometry";
import { RulerGutter } from "./RulerGutter";
import { WordStrip } from "./WordStrip";

interface LineRowProps {
  line: SubtitleLine;
  selected: boolean;
  active: boolean;
  onSelect: (id: string) => void;
}

/**
 * memo is load-bearing. The list container re-renders on any document change;
 * rows only re-render when their own line object identity changes. Store
 * updates MUST preserve references for untouched lines.
 */
export const LineRow = memo(function LineRow({
  line,
  selected,
  active,
  onSelect,
}: LineRowProps) {
  return (
    <div className="flex gap-4">
      <RulerGutter selected={selected} />
      <button
        type="button"
        onClick={() => onSelect(line.id)}
        style={{ minHeight: lineHeight(line.end - line.start) }}
        className={`group flex w-full flex-col gap-2 rounded-md px-3 py-3 text-left
                    transition-colors focus-visible:outline-2 focus-visible:outline-offset-2
                    focus-visible:outline-edit ${
                      selected ? "bg-raised" : "hover:bg-raised/50"
                    }`}
      >
        <div className="flex items-baseline justify-between">
          <span
            className={`tabular text-xs ${active ? "text-now" : "text-ink-muted"}`}
          >
            {formatTimecode(line.start)}
          </span>
          <span className="tabular text-xs text-ink-muted">
            {formatTimecode(line.end)}
          </span>
        </div>

        <p className={`text-base leading-snug ${active ? "text-now" : "text-ink"}`}>
          {line.words.map((w) => w.text).join(" ")}
        </p>

        {selected && <WordStrip line={line} />}
      </button>
    </div>
  );
});
```

- [ ] **Step 5: Create the list**

Create `apps/studio/src/lines/LineList.tsx`:

```tsx
import type { PlayerRef } from "@remotion/player";
import { Fragment, useCallback } from "react";
import { useStudioStore } from "@/store";
import { FPS } from "@/lib/constants";
import { LineRow } from "./LineRow";
import { Interstitial } from "./Interstitial";
import { Playhead } from "./Playhead";

export function LineList({
  playerRef,
}: {
  playerRef: React.RefObject<PlayerRef | null>;
}) {
  const lines = useStudioStore((s) => s.lines);
  const selectedLineId = useStudioStore((s) => s.selectedLineId);
  const select = useStudioStore((s) => s.select);

  // One click selects AND seeks — spec §"one click does everything".
  const onSelect = useCallback(
    (id: string) => {
      select(id);
      const line = useStudioStore.getState().lines.find((l) => l.id === id);
      if (line) playerRef.current?.seekTo(Math.round(line.start * FPS));
    },
    [select, playerRef],
  );

  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-hairline p-12 text-center">
        <p className="font-display text-lg">No lines yet.</p>
        <p className="mt-1 text-sm text-ink-muted">
          Add one at the playhead, or load the demo.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <Playhead playerRef={playerRef} />
      {lines.map((line, i) => (
        <Fragment key={line.id}>
          {i > 0 && <Interstitial gapSec={line.start - lines[i - 1].end} />}
          <LineRow
            line={line}
            selected={line.id === selectedLineId}
            active={false}
            onSelect={onSelect}
          />
        </Fragment>
      ))}
    </div>
  );
}
```

> `active` is hardcoded `false` here and wired to the real playhead in Task 9. `Playhead` is created in Task 9 — the build will fail until then.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/lines/
git commit -m "feat(studio): add line list, rows, ruler and gap interstitials"
```

---

## Task 8: Word Strip

The signature element. Word timings are computed, so without this the user has no way to see whether the algorithm produced anything sane.

**Files:**
- Create: `apps/studio/src/lines/WordStrip.tsx`

**Interfaces:**
- Consumes: `SubtitleLine`.
- Produces: `WordStrip({ line })`.

- [ ] **Step 1: Write the component**

Create `apps/studio/src/lines/WordStrip.tsx`:

```tsx
import type { SubtitleLine } from "@captionly/engine";

/**
 * Chips sized to each word's share of the line's duration, so computed word
 * timings are inspectable rather than invisible.
 *
 * The stagger is one of the two microinteractions in the design; the global
 * prefers-reduced-motion rule in styles.css collapses it.
 */
export function WordStrip({ line }: { line: SubtitleLine }) {
  const span = line.end - line.start;
  if (span <= 0 || line.words.length === 0) return null;

  return (
    <div className="flex w-full gap-px overflow-hidden rounded-sm" aria-hidden>
      {line.words.map((w, i) => (
        <span
          key={w.id}
          title={`${w.text} · ${(w.end - w.start).toFixed(2)}s`}
          style={{
            flexGrow: Math.max(0.0001, w.end - w.start),
            flexBasis: 0,
            animationDelay: `${i * 18}ms`,
          }}
          className="animate-in fade-in slide-in-from-left-1 truncate bg-raised px-1.5
                     py-1 text-center text-[0.625rem] text-ink-muted duration-200"
        >
          {w.text}
        </span>
      ))}
    </div>
  );
}
```

> `animate-in fade-in slide-in-from-left-1` comes from `tw-animate-css`, already a dependency.

- [ ] **Step 2: Commit**

```bash
git add apps/studio/src/lines/WordStrip.tsx
git commit -m "feat(studio): add duration-proportional word strip"
```

---

## Task 9: Playhead, Active Line & Auto-scroll

**Files:**
- Create: `apps/studio/src/lines/Playhead.tsx`
- Modify: `apps/studio/src/lines/LineList.tsx`

**Interfaces:**
- Consumes: `useCurrentPlayerFrame` (Task 5), `FPS`, `lineHeight`, `voidHeight`.
- Produces: `Playhead({ playerRef })`, and `LineList` now derives `active` from the current frame.

- [ ] **Step 1: Create the playhead**

Create `apps/studio/src/lines/Playhead.tsx`:

```tsx
import type { PlayerRef } from "@remotion/player";
import { useCurrentPlayerFrame } from "@/lib/useCurrentPlayerFrame";
import { useStudioStore } from "@/store";
import { FPS } from "@/lib/constants";
import { lineHeight, voidHeight } from "./geometry";

/**
 * THE ONLY FRAME SUBSCRIBER in the app. See spec §6.2.1.
 *
 * It re-renders at fps by design, which is why it renders one absolutely
 * positioned element and nothing else. Do not add store writes here, and do
 * not call useCurrentPlayerFrame anywhere above a leaf.
 */
export function Playhead({
  playerRef,
}: {
  playerRef: React.RefObject<PlayerRef | null>;
}) {
  const frame = useCurrentPlayerFrame(playerRef);
  const lines = useStudioStore((s) => s.lines);
  const t = frame / FPS;

  // Walk the same geometry the list lays out with, accumulating offsets.
  let offset = 0;
  let top: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      const gap = lines[i].start - lines[i - 1].end;
      if (gap > 0.001) offset += voidHeight(gap);
      else offset += 1;
    }
    const h = lineHeight(lines[i].end - lines[i].start);
    if (t >= lines[i].start && t <= lines[i].end) {
      const progress = (t - lines[i].start) / (lines[i].end - lines[i].start);
      top = offset + progress * h;
      break;
    }
    offset += h;
  }

  if (top === null) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 right-0 z-10 h-px bg-now"
      style={{ top }}
    />
  );
}
```

- [ ] **Step 2: Derive the active line in the list**

In `apps/studio/src/lines/LineList.tsx`, the active line must be computed **without** subscribing the list to frames. Add a tiny sibling subscriber instead. Replace the `<Playhead .../>` line and the `active={false}` prop by introducing an `ActiveLineMarker`:

Add to `Playhead.tsx`, exported alongside `Playhead`:

```tsx
/** Returns the id of the line under the playhead, or null. Leaf-only. */
export function useActiveLineId(
  playerRef: React.RefObject<PlayerRef | null>,
): string | null {
  const frame = useCurrentPlayerFrame(playerRef);
  const lines = useStudioStore((s) => s.lines);
  const t = frame / FPS;
  return lines.find((l) => t >= l.start && t <= l.end)?.id ?? null;
}
```

Then in `LineList.tsx`, wrap only the rows in a leaf that consumes it:

```tsx
function Rows({
  playerRef,
  onSelect,
}: {
  playerRef: React.RefObject<PlayerRef | null>;
  onSelect: (id: string) => void;
}) {
  const lines = useStudioStore((s) => s.lines);
  const selectedLineId = useStudioStore((s) => s.selectedLineId);
  const activeId = useActiveLineId(playerRef);
  const activeRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll keyed on the active id, so this fires once per line change
  // rather than once per frame.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={line.id}>
          {i > 0 && <Interstitial gapSec={line.start - lines[i - 1].end} />}
          <div ref={line.id === activeId ? activeRef : undefined}>
            <LineRow
              line={line}
              selected={line.id === selectedLineId}
              active={line.id === activeId}
              onSelect={onSelect}
            />
          </div>
        </Fragment>
      ))}
    </>
  );
}
```

Then in `LineList`, replace the `lines.map(...)` block in the return with `<Rows playerRef={playerRef} onSelect={onSelect} />`, and update the imports:

```tsx
import { Fragment, useCallback, useEffect, useRef } from "react";
import { Playhead, useActiveLineId } from "./Playhead";
```

`LineList` itself no longer reads `selectedLineId` — delete that selector from it, keeping only `lines` (for the empty-state check) and `select`.

> `Rows` re-renders at fps, but every `LineRow` inside it is memoized, so only the two rows whose `active` prop actually flips will re-render. This is the arrangement the Profiler check in Task 10 verifies.

- [ ] **Step 3: Build**

```bash
cd /Users/video/Desktop/captionly && bun run build:frontend
```

Expected: build succeeds. This is the first task where the whole tree compiles.

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/lines/
git commit -m "feat(studio): add playhead, active line highlight and auto-scroll"
```

---

## Task 10: Undo Keybindings & Final Verification

**Files:**
- Modify: `apps/studio/src/app/StudioShell.tsx`

**Interfaces:**
- Consumes: `useStudioStore.undo/redo`.
- Produces: `⌘Z` / `⌘⇧Z` bound globally, suppressed in text fields.

- [ ] **Step 1: Add the keybindings**

In `StudioShell.tsx`, add the import `useEffect` and this effect after the store selectors:

```tsx
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;

      // Let text fields keep their native field-level undo.
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      ) {
        return;
      }

      e.preventDefault();
      e.shiftKey ? redo() : undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);
```

- [ ] **Step 2: Run the full check suite**

```bash
cd /Users/video/Desktop/captionly && bun run lint && bun run build:frontend && (cd apps/studio && bun test)
```

Expected: lint clean, build succeeds, 15 tests pass (6 timecode + 9 history).

- [ ] **Step 3: Run the app and walk the spec's verification list**

```bash
cd /Users/video/Desktop/captionly && bun run dev:frontend
```

Confirm each, per spec §9:

- [ ] Dark by default, no console errors.
- [ ] Timecodes render as `M:SS.cc` in IBM Plex Mono with aligned columns.
- [ ] `sampleSubtitles` is `0.2→4.5`, `5.0→9.5`, `10.0→15.0` — **both boundaries are 0.50s gaps** and must render as labelled dashed voids.
- [ ] Temporarily set `line-2.start = 4.5` in `packages/engine/src/sampleData.ts`, confirm the **hairline** renders instead of a void, then **revert the edit**. (Sample data has no butt joint, so this case is otherwise untestable.)
- [ ] Block heights vary with duration within the 72–200px clamp.
- [ ] On playback: the amber playhead sweeps, the active line turns amber, the list auto-scrolls.
- [ ] Clicking a line selects it, seeks the player to its In point, and reveals its word strip.
- [ ] Style and Animation changes in the Style tab drive the player live.
- [ ] `⌘Z` / `⌘⇧Z` undo and redo a style change; a new edit clears the redo stack.
- [ ] Keyboard focus is visible on the play button, tabs, export, and every line row.
- [ ] With OS reduced-motion on, the word strip appears without staggering.
- [ ] Export dialog opens and a server-mode export completes.

- [ ] **Step 4: Profiler re-render check (spec §9.5)**

Open React DevTools → Profiler → enable "Highlight updates when components render", then play.

Expected: only `Playhead`, `Rows`, and the two `LineRow`s whose active state flips highlight per frame.

If the whole list or unrelated rows highlight, a global constraint has been violated — check that no store write happens in `Playhead`, and that nothing calls `useCurrentPlayerFrame` above a leaf.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/app/StudioShell.tsx
git commit -m "feat(studio): bind undo and redo keyboard shortcuts"
```

---

## Self-Review Notes

**Spec coverage:** §4.2 palette → T1. §4.3 type → T1. §4.4 timecode → T2. §4.5 motion → T1 (reduced-motion), T7 (interstitial hover), T8 (stagger). §5 layout → T6. §5.1 structure → T6/T7. §5.2 fixture → T3. §6.1 slices → T3/T4. §6.2 re-render → T7 (memo), T9 (leaf), T10 (Profiler). §6.3 undo → T4/T10. §7 deletions → T6. §8 copy → T1/T6/T7. §9 verification → T10. §10 risks → T1 (border alpha), T6 (null guard).

**Known ordering consequence:** Tasks 6–8 do not build in isolation — `StudioShell` imports `LineList` (T7), which imports `Playhead` (T9). The tree first compiles at Task 9 Step 3. Each task still commits independently; only the build gate moves.

**Deferred to later sub-projects, intentionally:** upload and real video metadata (SP2), resolution-independent style units (SP2), all line mutation and the word-timing algorithm (SP3), the shadcn rework of `StylePanel`/`AnimationPanel` (SP4). The `subtitleDrawer.ts` animation fidelity gap is pre-existing and out of scope for all four.
