# Studio Shell & Document Store Design Spec

**Date:** 2026-08-31
**Status:** Approved for Implementation Planning
**Target:** `apps/studio`
**Program:** Frontend Revamp — sub-project 1 of 4

---

## 1. Overview & Problem Statement

`apps/studio` today is a demo harness, not an editor. It renders one route containing a
header and a `[player | 340px sidebar]` grid. Everything a user would want to control is
hardcoded:

```ts
const VIDEO_SRC = "/test1.mp4";
const DURATION_IN_FRAMES = 450; // 15s at 30fps
<StudioPlayer subtitles={{ lines: sampleSubtitles, ... }} />
```

Concretely, the following are wrong or absent:

1. **No document.** Video source and subtitle lines are module constants. There is no
   subtitle editor of any kind — no add, delete, merge, split, or retime.
2. **State cannot scale.** All editor state is `useState` inside `SubtitleEditor.tsx`.
   Adding a line list, selection, and undo on top of that would re-render the whole
   editor on every keystroke.
3. **~700 lines of dead code.** `subtitle/useStudioPlayer.ts` (411 lines) and
   `subtitle/VideoControls.tsx` (287 lines) drive a raw `<video>` element via `videoRef`.
   They are leftovers from the pre-Remotion architecture. Nothing imports them —
   `StudioPlayer.tsx` uses `<Player controls />` from `@remotion/player` instead.
4. **`position` is inert.** `SubtitleEditor` holds `position` state whose setter is never
   passed to any component, and `StylePanel` tells the user to "drag the caption on the
   canvas to reposition" — an affordance removed with Fabric.js.
5. **Stale identity.** `routes/index.tsx` and `routes/__root.tsx` still describe the app as
   "built with React, TypeScript and Fabric.js". Fabric was removed on 2026-08-24.
6. **shadcn is installed but unused.** All 40+ components exist under
   `src/components/ui/`, yet `StylePanel` and `AnimationPanel` are built from raw
   `<select>`, `<input type="range">`, and `<input type="color">`.
7. **No visual identity.** The `.dark` theme is fully defined in `styles.css` and nothing
   ever applies the class. The palette is stock shadcn slate.

### Goal

Establish the shell every later sub-project builds inside: a distinct visual language, a
selector-subscribed document store with undo/redo, and a two-column layout frame. Sample
data stays wired throughout, so the app remains runnable and visibly improved at the end
of this sub-project without depending on upload or the line editor.

---

## 2. Program Context

The frontend revamp is split into four sub-projects, ordered so the app runs at every step
and no UI is built twice. **This spec covers sub-project 1 only.**

| # | Sub-project | Contents |
|---|---|---|
| **1** | **Shell + document store** | Visual language, zustand store, undo/redo, selection, layout frame, deletions. *This spec.* |
| 2 | Video in | Upload → object URL, duration/dimensions from `loadedmetadata`, composition sized from file, resolution-independent style units, empty states. |
| 3 | Line editor | Add/edit/delete/merge/split/retime, word-timing algorithm, two-way player sync, keyboard-first entry. |
| 4 | Style system | shadcn-ified panels, presets, expanded style surface. |

The visual pass is deliberately first, not last: building the line editor and then
redesigning it is double work.

### Cross-cutting decisions (settled, apply to all four)

- **Styling is global only.** One `SubtitleStyle` for the whole project, with a much
  deeper control surface in sub-project 4. No per-line or per-word overrides. `SubtitleStyle`
  stays a flat object and `packages/engine` types are unchanged.
- **Any aspect ratio, derived from upload.** Composition dimensions come from the file.
  Style values must become resolution-independent — this is sub-project 2's work and
  touches `SubtitleOverlay`, `subtitleDrawer`, and `SafeZones`.
- **Subtitles are typed manually.** No SRT/VTT/JSON import and no autotranscription. The
  user enters a line as a text + time range; **word timings are computed** by
  character-weighted distribution with punctuation pause bonuses and a per-word minimum,
  normalized to fill the range exactly (sub-project 3).
- **No per-word timing nudging.** The algorithm is the source of word timings. Revisit only
  if it proves insufficient in practice.
- **Server render is the source of truth.** `apps/studio/src/export/subtitleDrawer.ts`
  ignores `subtitles.animation` entirely — it draws a single hardcoded active-word
  highlight, so all nine engine animations currently export incorrectly via the client
  WebCodecs path. This is pre-existing. The client export path must be labelled or gated to
  what it can honestly render. **Not fixed in this sub-project**, but recorded so it is not
  mistaken for new breakage.

---

## 3. Scope

### In scope

- Design tokens, typography, and the dark-default theme in `styles.css`.
- The zustand store: three slices, undo/redo with coalescing, selection.
- The two-column app shell: sticky player rail + tabbed work surface.
- Re-render discipline for the playhead.
- Deletion of dead code and stale copy.

### Out of scope

- Video upload (2). Line editing UI (3). Style panel rework (4).
- Any change to `packages/engine` or `apps/render`.
- Fixing `subtitleDrawer.ts` animation fidelity.

### Non-goals

- Persistence to disk or server. The document lives in memory for now.
- Mobile layout below `md`. The shell degrades to stacked, but the line editor is a
  desktop tool and is not being optimized for touch.

---

## 4. Visual Design System

### 4.1 Direction

The subject is broadcast subtitling. The industry term for placing subtitle timings is
**spotting**, and that word anchors the vocabulary: the interface is organized around
*time*, not around objects. Timecode is treated as a first-class typographic element
rather than metadata.

The signature consequence: **there is no bottom timeline.** The transcript *is* the
timeline, rotated 90°. A ruler gutter runs down the left edge of the line list; each line's
block height is proportional to its duration and gaps render as literal voids. A single
amber playhead sweeps down the gutter during playback. This removes a UI region every
competitor has (CapCut, Kapwing, Veed) and makes "select a line → seek the player"
reciprocal: position in the list *is* position in the video.

Heights are **proportional but clamped** to 72–200px per line, and a void clamps to 120px
with its duration labelled. Proportion is relative and legible rather than literal, so a
40-second silence does not produce a scroll marathon.

### 4.2 Color

Deep desaturated blue-black surfaces — the ground of a video scope, not pure black. Two
accents, each with exactly one meaning, so color carries information rather than decoration:

- **Amber = now.** Playhead, active line. This is what a playhead is in every NLE.
- **Violet = edit affordance.** Merge/add/split pills, focus rings. Carried from the
  reference the user supplied.
- **Gaps get no color.** Silence is rendered as absence — a dashed void — not as a hue.

All values in oklch, per the existing `styles.css` contract. Added to `:root` and
registered in `@theme inline` alongside the existing shadcn variables:

| Token | Role | Hex (ref) | oklch |
|---|---|---|---|
| `--void` | page ground | `#0B0D12` | `oklch(0.1593 0.0111 267.98)` |
| `--surface` | rail, card | `#12151D` | `oklch(0.1964 0.0168 268.77)` |
| `--raised` | row hover | `#1A1F2A` | `oklch(0.2394 0.0225 265.67)` |
| `--hairline` | dividers | `#252B38` | `oklch(0.2891 0.0254 265.46)` |
| `--now` | playhead, active | `#F5A524` | `oklch(0.7819 0.1585 72.33)` |
| `--edit` | affordances, focus | `#8B7CF6` | `oklch(0.6569 0.1758 286.11)` |
| `--ink` | primary text | `#E8EAF0` | `oklch(0.9372 0.0084 271.33)` |
| `--ink-muted` | secondary text | `#8B93A7` | `oklch(0.6635 0.0311 268.21)` |

The existing shadcn slate variables are remapped onto these so installed components inherit
the identity without being rewritten. Dark is the default and only theme; the `.dark` class
is applied on `<html>` in `RootShell`.

### 4.3 Typography

Three roles, deliberately not the default Inter + JetBrains pairing:

- **Display — Bricolage Grotesque.** Wordmark, empty-state statements, section headings.
  Variable width and weight, with enough character to carry the identity. Used with
  restraint: display sizes only, never body.
- **UI — Archivo.** Labels, buttons, line text, panel controls. Technical grotesque that
  stays neutral at small sizes.
- **Numeric — IBM Plex Mono, `font-variant-numeric: tabular-nums`.** Every timecode,
  duration, and numeric field. Tabular figures are required, not cosmetic: timecodes sit in
  aligned columns at the left and right of each line block and must not shift width as
  digits change.

Loaded self-hosted via `@fontsource` packages rather than a Google Fonts `<link>`, so the
editor has no render-blocking third-party request and works offline.

Type scale (rem, 16px base): `0.6875 / 0.75 / 0.8125 / 0.875 / 1 / 1.25 / 1.75 / 2.5`.

### 4.4 Timecode format

`M:SS.cc` (e.g. `0:08.40`), extending to `H:MM:SS.cc` only when the video exceeds one hour.
Centiseconds are non-negotiable — word-level animation depends on sub-second precision, and
the reference format `00:00:08` hides exactly the digits that matter.

### 4.5 Motion

Two microinteractions carry the personality. Everything else is instant.

1. **The interstitial pill grows out of the hairline on hover** — the divider between two
   lines expands and the Merge/Add control scales up from it, so the affordance visibly
   belongs to the boundary it acts on.
2. **Committing a line settles it into place**, with its word strip staggering in
   left-to-right — making the computed word timings feel derived rather than arbitrary.

Both respect `prefers-reduced-motion: reduce`, which drops them to opacity-only.

---

## 5. Layout Shell

Two columns, not three. A permanent style column would compress the transcript to ~400px
and destroy its vertical rhythm; and styling and line entry are different modes of work —
users do not restyle while typing. Submagic reaches the same conclusion, splitting
"Subtitle" and "Design" into separate sections.

```
┌──────────────────────────┬─────────────────────────────────────────────────┐
│  ◆ captionly    demo.mp4 · 1080×1920 · 0:42       ⌘Z ⌘⇧Z        Export     │
├──────────────────────────┼─────────────────────────────────────────────────┤
│                          │  ┌ Lines ─────┬─ Style ─┐          312 words    │
│      ┌────────────┐      │ ▏                                               │
│      │            │      │ ▏ 0:00.00                             0:02.10   │
│      │  preview   │      │ ▏ We appreciate your time after a tough loss    │
│      │ [captions] │      │ ├──────────────── ⌥ Merge ───────────────────   │
│      │            │      │ ▎ 0:02.10                             0:04.35   │
│      └────────────┘      │ ▎ the right message for the guys in that room?  │
│                          │ ▎ ┌───┬──┬────┬───┬──┬────┬──┬────┐             │
│   ▸  0:04.35 / 0:42.00   │ ▎ │the│..│....│...│..│....│..│....│             │
│   ━━━━━━●─────────────   │ ▎ └───┴──┴────┴───┴──┴────┴──┴────┘             │
│                          │ ┆                                               │
│   16:9  9:16  1:1  4:5   │ ┆    ＋ Add line · 1.0s free   ·   ⌥ Merge      │
│   safe zone: TikTok      │ ┆                                               │
│                          │ ▏ 0:10.00                             0:13.00   │
│                          │ ▏ and I said, look, man, I can't tell           │
└──────────────────────────┴─────────────────────────────────────────────────┘
   sticky · width follows AR      ▏line  ▎selected  ┆void      Lines ⇄ Style
```

- **Left: sticky player rail.** Width follows the video's aspect ratio — a 9:16 upload gets
  a narrow tall rail, 16:9 a wide short one — so the transcript takes whatever remains.
  Implemented as a CSS `clamp()` on rail width driven by the aspect ratio, with the player
  capped by available viewport height. Below the player: transport, aspect selector, safe
  zone selector.
- **Right: one scrolling work surface**, tabbed `Lines ⇄ Style` (shadcn `Tabs`). The player
  stays visible in both tabs, so style changes still preview live.

**In this sub-project** the Lines tab renders the read-only list against `sampleSubtitles`
— ruler gutter, timecodes, proportional heights, voids, active-line highlight — and the
Style tab renders the existing `StylePanel`/`AnimationPanel` unchanged. The panels are
reworked in 4.

`Interstitial.tsx` is built here in its **visual form only**: it renders a butt joint as a
hairline and a gap as a labelled dashed void, sized to the gap's duration. The controls it
hosts — `Merge lines`, `Add line · Ns free` — and inline text editing arrive in
sub-project 3. The component exists now because the void is a layout concern the list
cannot be built without.

### 5.1 Component structure

```
src/
├── app/
│   ├── StudioShell.tsx        # two-column frame, header
│   ├── PlayerRail.tsx         # sticky rail: player + transport + aspect/safe-zone
│   └── WorkSurface.tsx        # Tabs: Lines | Style
├── lines/
│   ├── LineList.tsx           # scroll container, maps ids → memoized rows
│   ├── LineRow.tsx            # React.memo — one line block
│   ├── Interstitial.tsx       # boundary between two rows (gap-aware; visual only in SP1)
│   ├── WordStrip.tsx          # duration-proportional word chips (selected row)
│   ├── RulerGutter.tsx        # left spotting ruler
│   └── Playhead.tsx           # leaf; the ONLY frame subscriber
├── store/
│   ├── index.ts               # create<Doc & Editor & History>()
│   ├── documentSlice.ts
│   ├── editorSlice.ts
│   ├── historySlice.ts
│   └── selectors.ts
└── lib/timecode.ts            # format/parse M:SS.cc
```

---

## 6. Document Store

`zustand` v5 (new dependency on `apps/studio`), slices pattern, one bound store.

### 6.1 Slices

```ts
// documentSlice — the serializable document. Undo snapshots this and only this.
interface DocumentSlice {
  video: { src: string; durationSec: number; width: number; height: number } | null;
  lines: SubtitleLine[];
  style: SubtitleStyle;
  animation: AnimationConfig;
  position: SubtitlePosition;
  setStyle: (patch: Partial<SubtitleStyle>) => void;
  setAnimation: (a: AnimationConfig) => void;
  setPosition: (p: SubtitlePosition) => void;
}

// editorSlice — UI state. Deliberately NOT undoable.
interface EditorSlice {
  selectedLineId: string | null;
  editingLineId: string | null;
  activeTab: "lines" | "style";
  select: (id: string | null) => void;
  beginEdit: (id: string) => void;
  endEdit: () => void;
  setTab: (t: "lines" | "style") => void;
}

// historySlice
interface HistorySlice {
  past: DocumentSnapshot[];
  future: DocumentSnapshot[];
  commit: (label: string) => void;
  undo: () => void;
  redo: () => void;
}
```

Composed with `StateCreator<Doc & Editor & History, [], [], Slice>` per slice and combined
in a single `create<Doc & Editor & History>()((...a) => ({ ...createDocumentSlice(...a), ... }))`.

Components read with atomic selectors (`useStudioStore(s => s.style.fontSize)`) and use
`useShallow` from `zustand/react/shallow` only where a selector builds an object or array.

### 6.2 Re-render discipline

Three rules, and two of them are traps zustand does not solve on its own.

1. **The playhead frame never enters the store.** It comes from Remotion's
   `useCurrentPlayerFrame`, ticking at fps. Writing it into zustand would re-render every
   subscriber on every frame — the exact problem the library was chosen to avoid. The hook
   is called in exactly one leaf component (`Playhead.tsx`), which positions the amber
   marker and derives the active line id. Nothing else subscribes to frames.
2. **`lines` stays a plain array; rows are `React.memo`.** A normalized `lineIds[] +
   linesById{}` shape was considered and rejected: it is two structures to keep in sync for
   no measurable gain. Provided updates are immutable and **preserve object references for
   untouched lines**, memoized rows already skip re-rendering. The container re-renders per
   keystroke and maps a few hundred ids to memoized children — sub-millisecond. Normalize
   later only if a profile demands it.
3. **`selectedLineId` lives in the editor slice, not on the line.** Selection must not
   mutate `lines`, or every row's reference changes and rule 2 collapses.

### 6.3 Undo/redo

Snapshot-based over the document slice only. The document is small (lines + style +
animation + position), so structural sharing is unnecessary and no `immer` is required.

Coalescing is the only non-trivial part — typing a line must not produce forty undo entries:

- Discrete actions (merge, split, delete, add, retime, style change) call `commit(label)`
  directly, pushing a snapshot and clearing `future`.
- Text edits coalesce: if the top of `past` was produced by a text edit **to the same line
  id within 600ms**, replace it rather than pushing.
- `past` is capped at 100 entries.

`zundo` provides this via `handleSet` throttling but is a second dependency to control ~25
lines of logic. Rejected on those grounds; revisit if the coalescing rules grow.

Bound to `⌘Z` / `⌘⇧Z`, suppressed while a text input has focus so native field-level undo
still works.

---

## 7. Deletions & Cleanup

| Path | Lines | Action | Reason |
|---|---|---|---|
| `src/subtitle/useStudioPlayer.ts` | 411 | **Delete** | Dead. Drives a raw `<video>` via `videoRef`; no importers. |
| `src/subtitle/VideoControls.tsx` | 287 | **Delete** | Dead. Only importer is itself (imports the type from `useStudioPlayer`). |
| `src/routes/index.tsx` | — | Rewrite | Stale "Fabric.js" meta; header moves into `StudioShell`. |
| `src/routes/__root.tsx` | — | Edit | Stale "Fabric.js" title + og:description; add `class="dark"` to `<html>`. |
| `src/subtitle/StylePanel.tsx` | — | Edit | Remove the false "drag the caption on the canvas" instruction. |
| `src/subtitle/SubtitleEditor.tsx` | 88 | **Delete** | Replaced by `StudioShell` + store. |

> **Do not adapt `VideoControls.tsx` into the new transport.** It will look reusable when
> the custom transport is built, but it drives an `HTMLVideoElement` through `videoRef`;
> the Remotion player is controlled via `PlayerRef.seekTo(frame)`. Different API,
> different units. Write the transport fresh against `PlayerRef`.

`playerRef` is currently threaded into `StudioPlayer` and never used. It becomes load-bearing
in this sub-project — the transport and the select-to-seek behaviour both need it.

---

## 8. Copy

Interface vocabulary, fixed here so later sub-projects stay consistent:

- A unit of subtitle is a **line** — never "caption", "cue", or "segment".
- Actions keep their name through the flow: the control says **Merge lines**, the undo
  entry says "Merge lines".
- Timecodes are **In** and **Out**, matching the broadcast vernacular the design borrows.
- The empty state is an invitation, not an apology: **"No lines yet. Add one at the
  playhead, or load the demo."**
- Errors state what happened and what to do, in the interface's voice, and never apologize.

The app is titled **Captionly** throughout. All "Fabric.js" references are removed.

---

## 9. Verification

Mostly manual, per the existing project convention — `apps/studio` has no tests today
(`apps/render/src/server.test.ts` is the only test in the repo, run with `bun test`).

**One automated test is required.** The undo coalescing rules in §6.3 are branch-and-timing
logic that fails silently and invisibly when wrong — a broken 600ms window produces forty
undo entries per typed line, which nobody notices until undo is unusable. Add
`src/store/historySlice.test.ts` (`bun test`, no framework beyond it) covering:

- a discrete action pushes exactly one snapshot and clears `future`;
- two text edits to the **same** line within 600ms produce **one** entry;
- two text edits to **different** lines within 600ms produce **two**;
- two text edits to the same line more than 600ms apart produce **two**;
- `past` never exceeds 100 entries.

The word-timing algorithm gets its own test in sub-project 3.

1. `bun run dev:frontend` — app boots, dark by default, no console errors.
2. `bun run build:frontend` and `bun run lint` — both clean.
3. Sample subtitles render in the Lines tab: correct timecodes at `M:SS.cc`, block heights
   proportional within the 72–200px clamp. `sampleSubtitles` is `0.2→4.5`, `5.0→9.5`,
   `10.0→15.0` — so both boundaries are **0.50s gaps** and must render as labelled voids.
   Note it contains **no butt-joined boundary**, so the hairline case cannot be verified
   from sample data alone: temporarily set `line-2.start = 4.5` to confirm the hairline
   renders and the void does not.
4. Playback: the amber playhead sweeps the gutter, the active line highlights, and the list
   auto-scrolls to keep it in view.
5. **Re-render check** — React DevTools Profiler with "Highlight updates" on: during
   playback only `Playhead` and the two affected `LineRow`s re-render per frame. If the
   list container or unrelated rows flash, rule 6.2.1 or 6.2.2 has been violated.
6. Style/animation changes in the Style tab still drive the player live.
7. `⌘Z` / `⌘⇧Z` undo and redo a style change; the redo stack clears on a new edit.
8. Keyboard focus is visible on every interactive element; `prefers-reduced-motion: reduce`
   drops both microinteractions to opacity-only.
9. `grep -ri "fabric" apps/studio/src` returns nothing.
10. Export still works end to end from the new shell (server mode), proving the store's
    document shape feeds `ExportDialog` unchanged.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Proportional line heights make long videos an unusable scroll. | Heights clamped 72–200px, voids clamped to 120px with a duration label. Proportion is relative, not literal. If it still fails at 10min+, fall back to uniform heights and keep the ruler as a pure duration indicator. |
| Frame subscription leaks into the list and re-renders everything. | Single-leaf rule (6.2.1), enforced by the Profiler check in step 5. |
| Remapping shadcn's slate variables breaks installed components. | Remap the semantic variables only; do not edit files under `components/ui/`. Verify against `Dialog`, `Tabs`, `Select`, `Slider`, and `Sonner`, which the app already uses. |
| The no-bottom-timeline bet proves wrong once lines are editable. | Contained: the ruler gutter is one component (`RulerGutter`) and the list is a normal scroll container. Adding a conventional timeline later does not require restructuring the shell. |
| Aspect-driven rail width causes layout thrash on upload. | Rail width is a CSS `clamp()` on a single custom property set once when metadata resolves — not a JS resize loop. Do not mount `<Player>` before duration is known, or it receives `durationInFrames={0}`. |
