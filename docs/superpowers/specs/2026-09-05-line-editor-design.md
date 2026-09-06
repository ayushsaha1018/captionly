# SP3 — Line Editor — Design

**Date:** 2026-09-05
**Status:** implemented and verified
**Branch:** `feat/studio-line-editor` (branches from `feat/studio-video-in`)
**Scope:** `apps/studio/src/lines/`, `apps/studio/src/store/`, `apps/studio/src/app/`,
`apps/studio/src/lib/timecode.ts`, `packages/engine/src/`

---

## 1. Goal

The transcript becomes editable — add, edit, delete, merge, split, retime. This is the
largest sub-project in the frontend revamp program; see
`docs/superpowers/ROADMAP-frontend-revamp.md` §4 (SP3) and §5 (agreed interaction rules,
which this spec implements against, not redecides).

**Primary scenario (revised 2026-09-05):** a set of lines already exists (today: the demo
fixture standing in for a future autotranscription source) and the user freely edits it —
correcting text, merging misplaced splits, deleting extras, retiming boundaries, splitting
runs that should be two lines. This is what SP3 is designed and tested against.

**Secondary/fallback scenario:** an empty line list, populated by clicking "+ Add first line"
or keyboard-first typing (type, Enter, type, Enter...) via the contextual boundary affordances.
This remains fully supported — the same primitives (§3) drive both scenarios — but it is
not the showcased flow. See roadmap §1/§2/§7 for the program-level decision this revises.

---

## 2. Word-timing algorithm

New pure function in `packages/engine/src/wordTiming.ts`:

```ts
function computeWordTimings(text: string, start: number, end: number): Word[]
```

- Split `text` on whitespace into words.
- Weight each word by character count, plus a fixed pause bonus added to the weight of
  any word ending in `.`, `,`, `!`, or `?` (sentence/clause boundaries read as pauses).
- Distribute `end - start` across words proportionally to weight.
- Enforce a per-word minimum duration by clamping any word below the floor up to it,
  then re-normalizing the remainder proportionally among the words still above the
  floor. **If the floor itself is unsatisfiable** (`wordCount × minDuration > end - start`),
  drop the minimum entirely and fall back to plain proportional split — never emit a
  negative-width word.
- Force `words[0].start = start` and `words.at(-1).end = end` exactly after normalizing,
  so the range is filled exactly regardless of float drift.
- Assign each word a stable `id` (`crypto.randomUUID()`, consistent with existing id
  generation in the codebase).

This is the single source of word timings (roadmap §2). It is called by every store
action that changes a line's text or span (§4).

**Test** (`packages/engine/src/wordTiming.test.ts`):
- `words[0].start === line.start` and `words.at(-1).end === line.end` exactly.
- Words are monotonic and non-overlapping.
- Unsatisfiable-minimum case falls back to proportional split with no negative widths.
- Punctuation-terminated words receive more time than a same-length word without.

---

## 3. Store actions

All new actions live on `documentSlice` and follow the existing `loadVideo` contract
exactly: `commit(label, {coalesceKey})` **before** mutating, then `set()` with a new
`lines` array that **preserves object reference for every untouched line** (required by
`LineRow`'s memo, and to never mutate the `sampleSubtitles` fixture in place — it is
aliased by reference into the store in demo mode).

| Action | Behavior |
|---|---|
| `addLine(afterLineId: string \| null, startAt: number, endAt: number)` | Inserts a new line spanning `[startAt, endAt]` exactly (the caller decides the span — see below), empty text, `words: []`. Calls `beginEdit(newId)`. Commit label `"Add line"`. |
| `editLineText(id, text)` | Recomputes `words` via `computeWordTimings(text, line.start, line.end)`. Coalesce key `` `text:${id}` ``. |
| `setLineIn(id, seconds)` | Clamps to `[prevLine?.end ?? 0, line.end)`. Recomputes words. Coalesce key `` `retime:${id}:in` ``. |
| `setLineOut(id, seconds)` | Clamps to `(line.start, nextLine?.start ?? duration]`. Recomputes words. Coalesce key `` `retime:${id}:out` ``. |
| `deleteLine(id)` | Removes the line. No gap-fill needed — the interstitial recomputes the gap from neighbours automatically. Commit label `"Delete line"`. |
| `mergeLines(aId, bId)` | Concatenates `a.text + " " + b.text`, spans `[a.start, b.end]`, recomputes words across the full range, removes `b`. Commit label `"Merge lines"`. |
| `splitLine(id, caretIndex)` | Finds the nearest computed word boundary to `caretIndex`. Splits `[start, end]` and the text at that boundary into two lines, recomputes words for both. **No-ops** if the boundary is at the very start or end of the text (nothing to split). Commit label `"Split line"`. |

`addLine` takes an explicit range rather than a fixed duration because it has **two callers
with two different defaults**, resolved deliberately to avoid a conflict between them:

- **Interstitial "Add line" click** (§4) — you're looking at a specific, already-visible
  gap and want to claim it. Passes `endAt = gapStart + gapSec`: fills the *entire* gap.
- **Enter while editing** (§5) — rapid sequential authoring. Passes a **fixed short
  default duration** (3s, clamped to not exceed the remaining gap), not the whole gap.
  If Enter also filled the entire remaining gap, the very first line created this way
  would consume all remaining free time, and every subsequent Enter would have nothing
  left to create a line into — breaking the "type, Enter, type, Enter..." cold-start flow
  (roadmap exit criterion: reach a fully spotted transcript via keyboard). Fixed duration
  keeps that flow going; filling the whole gap on explicit click is fine because it's a
  single deliberate action, not a repeated one.
- A user who wants to type a whole transcript into one line and then carve it into
  individual lines can still do so: click "Add line" once on the full-duration gap, type
  everything, then split repeatedly with `⌘↵` at each boundary (§3 `splitLine`). Both
  workflows are supported; neither is forced.

---

## 4. Boundary interactions (floating pills)

Rather than rendering physical expanding dashed voids or a separate `Interstitial.tsx`
component (which created 120px layout shifts when hovered/mounted), boundary interactions
are rendered as non-shifting contextual floating pills:

- **Bottom-center floating pill (`[ Merge | + Add line ]`)**:
  Appears at `-bottom-3 left-1/2 -translate-x-1/2` when hovering anywhere over the row block
  (or on keyboard `focus-within`).
  - `Merge`: shown whenever `nextLineId` exists (merges with the subsequent line).
  - `+ Add line`: shown when there is an open gap to the next boundary (`> 0.05s`) or the
    line has duration `>= 1.0s` (in which case it splits the trailing half into a new line).
    On the last line, only `+ Add line` is displayed.
- **Top-center floating pill (`[ + Add line ]`)**:
  On the first line (`isFirst`), if a leading gap exists (`line.start > 0.05`), hovering the
  block reveals a floating pill at `-top-3 left-1/2 -translate-x-1/2`. Clicking it inserts a
  new subtitle line from `0` to `min(DEFAULT_LINE_DURATION, line.start)` at index 0.
- **Empty list state**:
  When `lines.length === 0`, `LineList` renders a clean empty state card with an explicit
  `+ Add first line` button spanning `0` to `min(DEFAULT_LINE_DURATION, duration)`.

`Interstitial.tsx` and `geometry.ts` (`voidHeight`/`lineHeight`) were retired completely.

---

## 5. Editable row

`LineRow` (`apps/studio/src/lines/LineRow.tsx`) drops `role="button"`/`tabIndex` from the
outer wrapper — it is a clean container hosting the timecode header, text editing area,
delete button, and boundary pills.

- **Natural 1-line default & dynamic growth**: artificial duration-proportional `minHeight`
  was removed. Rows default to a compact 1-line height. When editing, the text is rendered
  in an auto-growing `<textarea rows={1} ... className="... resize-none [field-sizing:content]" />`,
  which naturally expands vertically as text wraps or exceeds 1 line in both edit and view modes.
- **Click** the text → `onSelect` (select + seek) → focuses the textarea for inline editing
  (one click does everything).
- **Esc** while editing → `endEdit()`. Blurs, keeps selection, no seek.
- **⌘↵** while editing → `splitLine(id, caretPosition)`.
- **Enter** (without Shift) while editing → commits the text and exits edit mode, then:
  - if free time remains immediately after this line (`nextGapSec > 0`, whether a real
    gap or trailing gap with `duration - line.end > 0`), calls
    `addLine(line.id, line.end, Math.min(line.end + DEFAULT_LINE_DURATION, line.end + nextGapSec))` —
    a fixed short default duration (`DEFAULT_LINE_DURATION`, 2.5s), clamped to the gap;
  - otherwise, Enter just blurs. No line is created past the end of the video.
- **Shift+Enter** allows soft line breaks within a subtitle.

---

## 6. Retime fields

Two small tabular-mono numeric inputs (In / Out) replacing the plain timecode labels
when the line is selected (editable), reverting to plain labels otherwise. `@/lib/timecode.ts` gains `parseTimecode(input: string): number | null`
alongside the existing `formatTimecode`.

Clamping against neighbours happens **on commit** (blur or Enter on the field), not per
keystroke — so typing "1" then "12" doesn't fight the clamp mid-entry. An invalid parse
leaves the field's value unchanged (no commit).

---

## 7. Delete

A delete trash icon is positioned at the top-right of the row header (visible when selected
or hovered), calling `deleteLine(id)` with `onMouseDown={(e) => e.preventDefault()}` and
`e.stopPropagation()` to avoid blur/selection race conditions.

**And** a global `Backspace`/`Delete` handler added to the existing keydown listener in
`StudioShell.tsx` (same file as the ⌘Z undo/redo listener, same guard pattern): fires only
when `selectedLineId` is set, `editingLineId` is `null`, and the event target isn't an
INPUT/TEXTAREA/contentEditable element.

---

## 8. Playhead-follow (two-way sync)

In `Rows` (`LineList.tsx`), the existing `useActiveLineId`-driven auto-scroll effect gains
one line: when `activeId` changes and `editingLineId === null`, call `select(activeId)`.

`select()` itself remains a pure state setter — the seek-on-select behavior stays exactly
where it lives today, in `LineList.onSelect`. This means playback-follow updates
`selectedLineId` (and therefore highlighting/scroll) without ever triggering a seek, so
playback and the follow-selection never fight each other.

`WordStrip.tsx` was deleted to preserve visual simplicity and legibility across line rows.

---

## 9. Testing

- **Engine**: `wordTiming.test.ts` per §2.
- **Store**: one test per new action on the existing `documentSlice`/`historySlice`
  pattern — reference-preservation for untouched lines, commit-before-mutate ordering
  (undo lands on the pre-change snapshot), coalescing behavior (rapid edits within 600ms
  merge, edits further apart don't).
- **Manual browser verification** (this sub-project is UI-heavy). Primary scenario first:
  load a video with a pre-populated multi-line fixture and freely edit it — correct a
  line's text, merge two lines across a real gap, split a line via ⌘↵, delete a line via
  icon and via keyboard, retime In/Out via fields with neighbour clamping, click
  select+seek, playback-follow scroll/select without stealing edit focus from a line being
  actively edited, undo/redo across all of the above. Then, as a fallback check: the
  keyboard cold-start flow still works (empty list, type → Enter → type → Enter... to a
  fully spotted transcript, no mouse).

---

## 10. Build order

Keeps the app running at every step; nothing depends on an action that doesn't exist yet.

1. `computeWordTimings` + test (engine, no UI dependents yet)
2. Store actions (`addLine`, `editLineText`, `setLineIn`, `setLineOut`, `deleteLine`,
   `mergeLines`, `splitLine`) + tests
3. Interstitial wiring — leading/trailing gaps, Add/Merge buttons call the actions
4. Editable row — click-to-edit, Enter/Esc/⌘↵
5. In/Out numeric fields + `parseTimecode`
6. Delete — icon + keyboard
7. Playhead-follow (two-way sync)

---

## 11. Out of scope

Autotranscription itself (planned as a future sub-project, not yet speced — SP3 only
ensures the primitives work regardless of where lines come from), subtitle file import,
per-line/per-word style overrides, per-word timing nudging (roadmap §2 — the algorithm's
output is not hand-adjustable), drag-handle retiming (numeric fields only, per this spec
§6), mobile/touch optimization.
