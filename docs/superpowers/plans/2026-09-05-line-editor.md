# SP3 — Line Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the transcript editable — add, edit, delete, merge, split, and retime
lines — with free editing of an already-populated set of lines as the primary scenario
and keyboard-driven cold-start typing as a supported fallback.

**Architecture:** A single new pure function (`computeWordTimings`) in `packages/engine`
is the sole source of word timings, called by every store action that changes a line's
text or span. Seven new actions on `documentSlice` (add/edit/delete/merge/split/retime ×2)
each follow the existing `commit-then-set`, reference-preserving contract already
established by `loadVideo`. The interstitial (visual-only since SP1) gets its Add/Merge
buttons wired to those actions and gains leading/trailing gap positions. `LineRow` becomes
editable in place (click → input, Enter/Esc/⌘↵) and gains In/Out numeric fields and a
delete affordance. Playback gets a one-line addition to make the playhead drive selection.

**Tech Stack:** React 19, Zustand, TypeScript, Bun test runner (`bun:test`), Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-05-line-editor-design.md` — read it alongside
this plan; task descriptions below assume its §2–§8 as ground truth and don't repeat the
rationale already recorded there.

## Global Constraints

- Every new store action follows `loadVideo`'s contract exactly: `commit(label, opts)`
  **before** mutating, then `set()` with a new `lines` array that **preserves the same
  object reference for every untouched line** (required by `LineRow`'s `memo`, and to
  never mutate the `sampleSubtitles` fixture in place since it's aliased by reference in
  demo mode).
- `computeWordTimings` is the only place word timings are computed. No other code
  hand-assigns `Word.start`/`Word.end`.
- Coalesce keys: `text:${lineId}` (text edits), `` retime:${lineId}:in `` /
  `` retime:${lineId}:out `` (retime fields). Discrete actions (add/delete/merge/split)
  never coalesce (no `coalesceKey` passed).
- Vocabulary is fixed: a unit is a **line** (never caption/cue/segment); timecodes are
  **In**/**Out**; commit labels match the control's name exactly (`"Merge lines"`, not
  `"Merged lines"` or `"Merge"`).
- Timecodes are always rendered via `formatTimecode`/`parseTimecode`
  (`apps/studio/src/lib/timecode.ts` — both already exist, do not reimplement).
- All new IDs use `crypto.randomUUID()` (no new dependency; this is a standard Bun/browser
  API, matching the codebase's lack of any existing UUID library).

---

## Task 1: Word-timing algorithm

**Files:**
- Create: `packages/engine/src/wordTiming.ts`
- Create: `packages/engine/src/wordTiming.test.ts`
- Modify: `packages/engine/src/index.ts` (add one export line)

**Interfaces:**
- Produces: `computeWordTimings(text: string, start: number, end: number): Word[]`,
  exported from `@captionly/engine`. Every later task that touches line text or span
  calls this.

- [ ] **Step 1: Write the failing tests**

Create `packages/engine/src/wordTiming.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { computeWordTimings } from "./wordTiming";

describe("computeWordTimings", () => {
  it("fills the exact start/end range", () => {
    const words = computeWordTimings("hello there friend", 10, 13);
    expect(words[0].start).toBe(10);
    expect(words.at(-1)!.end).toBe(13);
  });

  it("produces monotonic, contiguous, non-overlapping words", () => {
    const words = computeWordTimings("one two three four", 0, 4);
    for (let i = 1; i < words.length; i++) {
      expect(words[i].start).toBe(words[i - 1].end);
      expect(words[i].end).toBeGreaterThan(words[i].start);
    }
  });

  it("gives a punctuation-terminated word more time than an equal-length word without", () => {
    const words = computeWordTimings("aaa aa.", 0, 10);
    const durationOf = (w: (typeof words)[number]) => w.end - w.start;
    expect(durationOf(words[1])).toBeGreaterThan(durationOf(words[0]));
  });

  it("falls back to proportional split with no negative widths when the minimum is unsatisfiable", () => {
    // 5 words at a 0.2s minimum would need 1.0s; only 0.3s is available.
    const words = computeWordTimings("a bb ccc dddd eeeee", 0, 0.3);
    expect(words).toHaveLength(5);
    for (const w of words) {
      expect(w.end).toBeGreaterThan(w.start);
    }
    expect(words[0].start).toBe(0);
    expect(words.at(-1)!.end).toBe(0.3);
  });

  it("returns an empty array for empty or whitespace-only text", () => {
    expect(computeWordTimings("", 0, 5)).toEqual([]);
    expect(computeWordTimings("   ", 0, 5)).toEqual([]);
  });

  it("assigns each word a unique id", () => {
    const words = computeWordTimings("a a a", 0, 3);
    const ids = new Set(words.map((w) => w.id));
    expect(ids.size).toBe(words.length);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/engine && bun test wordTiming.test.ts`
Expected: FAIL — `wordTiming.ts` does not exist yet.

- [ ] **Step 3: Implement `computeWordTimings`**

Create `packages/engine/src/wordTiming.ts`:

```ts
import type { Word } from "./types";

const MIN_WORD_DURATION = 0.2; // seconds
const PUNCTUATION_BONUS = 3; // extra weight for a trailing .,!?

function weightOf(word: string): number {
  const punctuationBonus = /[.,!?]$/.test(word) ? PUNCTUATION_BONUS : 0;
  return word.length + punctuationBonus;
}

/**
 * The single source of word timings (roadmap §2). Character-weighted
 * distribution with a punctuation pause bonus and a per-word minimum,
 * normalized to fill [start, end] exactly. See spec §2 for the algorithm
 * description this implements.
 */
export function computeWordTimings(text: string, start: number, end: number): Word[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const total = end - start;
  const weights = tokens.map(weightOf);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  let durations = weights.map((w) => (w / weightSum) * total);

  const minFits = tokens.length * MIN_WORD_DURATION <= total;
  if (minFits) {
    const belowFloor = durations.map((d) => d < MIN_WORD_DURATION);
    const flooredTotal = belowFloor.filter(Boolean).length * MIN_WORD_DURATION;
    const aboveIndices = belowFloor
      .map((isBelow, i) => (isBelow ? -1 : i))
      .filter((i) => i !== -1);
    const aboveWeightSum = aboveIndices.reduce((sum, i) => sum + weights[i], 0);
    const remaining = total - flooredTotal;

    durations = durations.map((d, i) => {
      if (belowFloor[i]) return MIN_WORD_DURATION;
      if (aboveWeightSum === 0) return d;
      return (weights[i] / aboveWeightSum) * remaining;
    });
  }

  const words: Word[] = [];
  let cursor = start;
  for (let i = 0; i < tokens.length; i++) {
    const wordEnd = cursor + durations[i];
    words.push({ id: crypto.randomUUID(), text: tokens[i], start: cursor, end: wordEnd });
    cursor = wordEnd;
  }

  // Force exact boundaries so the range is filled exactly regardless of float drift.
  words[0].start = start;
  words[words.length - 1].end = end;

  return words;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/engine && bun test wordTiming.test.ts`
Expected: PASS, all 6 tests.

- [ ] **Step 5: Export from the package**

Modify `packages/engine/src/index.ts` — add after the `Geometry & Layout` export:

```ts
// Word timing
export * from "./wordTiming";
```

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/wordTiming.ts packages/engine/src/wordTiming.test.ts packages/engine/src/index.ts
git commit -m "feat(engine): add computeWordTimings word-timing algorithm"
```

---

## Task 2: Store actions — `addLine` and `editLineText`

**Files:**
- Modify: `apps/studio/src/store/types.ts`
- Modify: `apps/studio/src/store/documentSlice.ts`
- Modify: `apps/studio/src/store/documentSlice.test.ts`

**Interfaces:**
- Consumes: `computeWordTimings` (Task 1).
- Produces: `addLine(afterLineId: string | null, startAt: number, endAt: number): void`,
  `editLineText(id: string, text: string): void`. Tasks 3–6 (other store actions) and
  Task 8 (editable row) call these.

- [ ] **Step 1: Add the action signatures to `DocumentSlice`**

Modify `apps/studio/src/store/types.ts` — in the `DocumentSlice` interface, after
`replaceDocument`:

```ts
  /** Used by history to restore. Does not itself record history. */
  replaceDocument: (doc: DocumentSnapshot) => void;
  /** Inserts a new empty line spanning [startAt, endAt] after `afterLineId`
   *  (null = insert at the very start) and begins editing it immediately. */
  addLine: (afterLineId: string | null, startAt: number, endAt: number) => void;
  /** Recomputes the line's words from `text` via computeWordTimings. */
  editLineText: (id: string, text: string) => void;
  setLineIn: (id: string, seconds: number) => void;
  setLineOut: (id: string, seconds: number) => void;
  deleteLine: (id: string) => void;
  mergeLines: (aId: string, bId: string) => void;
  splitLine: (id: string, caretIndex: number) => void;
```

(All seven are declared now so `types.ts` only needs one edit across this plan; Tasks
3–6 implement the remaining five in `documentSlice.ts`.)

- [ ] **Step 2: Write the failing tests**

Modify `apps/studio/src/store/documentSlice.test.ts` — add at the end, before the closing
`});` of the outer `describe`:

```ts
describe("addLine", () => {
  beforeEach(() => {
    useStudioStore.setState({
      video: { src: "/test.mp4", durationSec: 10, width: 1920, height: 1080 },
      lines: [{ id: "a", start: 0, end: 2, words: [] }],
      past: [],
      future: [],
      selectedLineId: null,
      editingLineId: null,
    });
  });

  it("inserts a new empty line at the given range and begins editing it", () => {
    useStudioStore.getState().addLine("a", 2, 4);
    const state = useStudioStore.getState();
    expect(state.lines).toHaveLength(2);
    expect(state.lines[1].start).toBe(2);
    expect(state.lines[1].end).toBe(4);
    expect(state.lines[1].words).toEqual([]);
    expect(state.editingLineId).toBe(state.lines[1].id);
    expect(state.selectedLineId).toBe(state.lines[1].id);
  });

  it("inserts at the front when afterLineId is null", () => {
    useStudioStore.getState().addLine(null, 0, 0);
    // won't collide in this test - just checking position
    const state = useStudioStore.getState();
    expect(state.lines[0].id).not.toBe("a");
    expect(state.lines[1].id).toBe("a");
  });

  it("preserves object reference for the untouched line and records undo", () => {
    const before = useStudioStore.getState().lines[0];
    useStudioStore.getState().addLine("a", 2, 4);
    const after = useStudioStore.getState();
    expect(after.lines[0]).toBe(before);
    expect(after.past.length).toBe(1);
    expect(after.past[0].label).toBe("Add line");
  });
});

describe("editLineText", () => {
  beforeEach(() => {
    useStudioStore.setState({
      video: { src: "/test.mp4", durationSec: 10, width: 1920, height: 1080 },
      lines: [{ id: "a", start: 0, end: 2, words: [] }],
      past: [],
      future: [],
    });
  });

  it("recomputes words to fill the line's existing span", () => {
    useStudioStore.getState().editLineText("a", "hello world");
    const line = useStudioStore.getState().lines[0];
    expect(line.words.map((w) => w.text)).toEqual(["hello", "world"]);
    expect(line.words[0].start).toBe(0);
    expect(line.words.at(-1)!.end).toBe(2);
  });

  it("coalesces rapid edits to the same line into one undo entry", () => {
    useStudioStore.getState().editLineText("a", "h");
    useStudioStore.getState().editLineText("a", "he");
    useStudioStore.getState().editLineText("a", "hel");
    expect(useStudioStore.getState().past.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/studio && bun test src/store/documentSlice.test.ts`
Expected: FAIL — `addLine`/`editLineText` are not functions on the store.

- [ ] **Step 3: Implement both actions**

Modify `apps/studio/src/store/documentSlice.ts`:

```ts
import type { StateCreator } from "zustand";
import type { SubtitleLine } from "@captionly/engine";
import { defaultStyle, defaultPosition, defaultAnimation, computeWordTimings } from "@captionly/engine";
import type { DocumentSlice, StudioState, VideoMeta } from "./types";

export const createDocumentSlice: StateCreator<StudioState, [], [], DocumentSlice> = (
  set,
  get,
) => ({
  video: null,
  lines: [],
  style: defaultStyle,
  animation: defaultAnimation,
  position: defaultPosition,

  loadVideo: (meta: VideoMeta, lines?: SubtitleLine[]) => {
    const current = get();
    if (current.video?.src.startsWith("blob:") && current.video.src !== meta.src) {
      try {
        URL.revokeObjectURL(current.video.src);
      } catch {
        // Safe ignore
      }
    }

    current.commit("Load video");
    set({
      video: meta,
      lines: lines ?? [],
      selectedLineId: null,
      editingLineId: null,
    });
  },

  setStyle: (patch) => set((s) => ({ style: { ...s.style, ...patch } })),
  setAnimation: (animation) => set({ animation }),
  setPosition: (position) => set({ position }),
  replaceDocument: (doc) => set({ ...doc }),

  addLine: (afterLineId, startAt, endAt) => {
    const state = get();
    state.commit("Add line");

    const newLine: SubtitleLine = {
      id: crypto.randomUUID(),
      start: startAt,
      end: endAt,
      words: [],
    };
    const idx = afterLineId ? state.lines.findIndex((l) => l.id === afterLineId) + 1 : 0;
    const lines = [...state.lines.slice(0, idx), newLine, ...state.lines.slice(idx)];

    set({ lines });
    get().beginEdit(newLine.id);
  },

  editLineText: (id, text) => {
    const state = get();
    const line = state.lines.find((l) => l.id === id);
    if (!line) return;

    state.commit("Edit line", { coalesceKey: `text:${id}` });
    const words = computeWordTimings(text, line.start, line.end);
    set({ lines: state.lines.map((l) => (l.id === id ? { ...l, words } : l)) });
  },
});
```

(Tasks 3–6 add `setLineIn`, `setLineOut`, `deleteLine`, `mergeLines`, `splitLine` to this
same object literal.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/studio && bun test src/store/documentSlice.test.ts`
Expected: PASS, all tests including the pre-existing `loadVideo` ones.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/store/types.ts apps/studio/src/store/documentSlice.ts apps/studio/src/store/documentSlice.test.ts
git commit -m "feat(studio): add addLine and editLineText store actions"
```

---

## Task 3: Store actions — `setLineIn` and `setLineOut`

**Files:**
- Modify: `apps/studio/src/store/documentSlice.ts`
- Modify: `apps/studio/src/store/documentSlice.test.ts`

**Interfaces:**
- Consumes: `computeWordTimings` (Task 1), `DocumentSlice` types (Task 2).
- Produces: `setLineIn(id: string, seconds: number): void`,
  `setLineOut(id: string, seconds: number): void`. Task 9 (TimecodeField) calls these.

- [ ] **Step 1: Write the failing tests**

Add to `apps/studio/src/store/documentSlice.test.ts`:

```ts
describe("setLineIn / setLineOut", () => {
  beforeEach(() => {
    useStudioStore.setState({
      video: { src: "/test.mp4", durationSec: 10, width: 1920, height: 1080 },
      lines: [
        { id: "a", start: 0, end: 2, words: [] },
        { id: "b", start: 2, end: 4, words: [] },
      ],
      past: [],
      future: [],
    });
  });

  it("setLineIn clamps to the previous line's end", () => {
    useStudioStore.getState().setLineIn("b", 1); // before "a" ends at 2
    expect(useStudioStore.getState().lines[1].start).toBe(2);
  });

  it("setLineIn clamps below its own end", () => {
    useStudioStore.getState().setLineIn("b", 4.5); // past its own end at 4
    const line = useStudioStore.getState().lines[1];
    expect(line.start).toBeLessThan(line.end);
  });

  it("setLineOut clamps to the next line's start", () => {
    useStudioStore.getState().setLineOut("a", 3); // past "b" starting at 2
    expect(useStudioStore.getState().lines[0].end).toBe(2);
  });

  it("setLineOut clamps to video duration for the last line", () => {
    useStudioStore.getState().setLineOut("b", 999);
    expect(useStudioStore.getState().lines[1].end).toBe(10);
  });

  it("recomputes words to fill the new span", () => {
    useStudioStore.getState().editLineText("a", "hi");
    useStudioStore.getState().setLineOut("a", 1);
    const line = useStudioStore.getState().lines[0];
    expect(line.words.at(-1)!.end).toBe(1);
  });

  it("coalesces rapid retimes to the same line and field, not across fields", () => {
    useStudioStore.getState().setLineOut("a", 1.5);
    useStudioStore.getState().setLineOut("a", 1.8);
    expect(useStudioStore.getState().past.length).toBe(1);

    useStudioStore.getState().setLineIn("a", 0.1);
    expect(useStudioStore.getState().past.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/studio && bun test src/store/documentSlice.test.ts`
Expected: FAIL — `setLineIn`/`setLineOut` are not functions.

- [ ] **Step 3: Implement both actions**

Add to the `createDocumentSlice` object in `apps/studio/src/store/documentSlice.ts`,
after `editLineText`:

```ts
  setLineIn: (id, seconds) => {
    const state = get();
    const idx = state.lines.findIndex((l) => l.id === id);
    if (idx === -1) return;
    const line = state.lines[idx];
    const prev = state.lines[idx - 1];
    const min = prev ? prev.end : 0;
    const start = Math.min(Math.max(seconds, min), line.end - 0.01);

    state.commit("Retime line", { coalesceKey: `retime:${id}:in` });
    const text = line.words.map((w) => w.text).join(" ");
    const updated: SubtitleLine = { ...line, start, words: computeWordTimings(text, start, line.end) };
    set({ lines: state.lines.map((l) => (l.id === id ? updated : l)) });
  },

  setLineOut: (id, seconds) => {
    const state = get();
    const idx = state.lines.findIndex((l) => l.id === id);
    if (idx === -1) return;
    const line = state.lines[idx];
    const next = state.lines[idx + 1];
    const max = next ? next.start : (state.video?.durationSec ?? Infinity);
    const end = Math.max(Math.min(seconds, max), line.start + 0.01);

    state.commit("Retime line", { coalesceKey: `retime:${id}:out` });
    const text = line.words.map((w) => w.text).join(" ");
    const updated: SubtitleLine = { ...line, end, words: computeWordTimings(text, line.start, end) };
    set({ lines: state.lines.map((l) => (l.id === id ? updated : l)) });
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/studio && bun test src/store/documentSlice.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/store/documentSlice.ts apps/studio/src/store/documentSlice.test.ts
git commit -m "feat(studio): add setLineIn and setLineOut store actions"
```

---

## Task 4: Store action — `deleteLine`

**Files:**
- Modify: `apps/studio/src/store/documentSlice.ts`
- Modify: `apps/studio/src/store/documentSlice.test.ts`

**Interfaces:**
- Produces: `deleteLine(id: string): void`. Task 9 (delete button, global keyboard
  handler) calls this.

- [ ] **Step 1: Write the failing tests**

Add to `apps/studio/src/store/documentSlice.test.ts`:

```ts
describe("deleteLine", () => {
  beforeEach(() => {
    useStudioStore.setState({
      video: { src: "/test.mp4", durationSec: 10, width: 1920, height: 1080 },
      lines: [
        { id: "a", start: 0, end: 2, words: [] },
        { id: "b", start: 2, end: 4, words: [] },
      ],
      past: [],
      future: [],
      selectedLineId: "b",
      editingLineId: "b",
    });
  });

  it("removes the line and clears selection/editing if it was selected", () => {
    useStudioStore.getState().deleteLine("b");
    const state = useStudioStore.getState();
    expect(state.lines).toHaveLength(1);
    expect(state.lines[0].id).toBe("a");
    expect(state.selectedLineId).toBeNull();
    expect(state.editingLineId).toBeNull();
  });

  it("leaves selection alone when deleting a different line", () => {
    useStudioStore.getState().deleteLine("a");
    expect(useStudioStore.getState().selectedLineId).toBe("b");
  });

  it("records undo", () => {
    useStudioStore.getState().deleteLine("b");
    expect(useStudioStore.getState().past[0].label).toBe("Delete line");
    useStudioStore.getState().undo();
    expect(useStudioStore.getState().lines).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/studio && bun test src/store/documentSlice.test.ts`
Expected: FAIL — `deleteLine` is not a function.

- [ ] **Step 3: Implement the action**

Add to the `createDocumentSlice` object, after `setLineOut`:

```ts
  deleteLine: (id) => {
    const state = get();
    state.commit("Delete line");
    set({ lines: state.lines.filter((l) => l.id !== id) });
    if (state.selectedLineId === id) get().select(null);
    if (state.editingLineId === id) get().endEdit();
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/studio && bun test src/store/documentSlice.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/store/documentSlice.ts apps/studio/src/store/documentSlice.test.ts
git commit -m "feat(studio): add deleteLine store action"
```

---

## Task 5: Store action — `mergeLines`

**Files:**
- Modify: `apps/studio/src/store/documentSlice.ts`
- Modify: `apps/studio/src/store/documentSlice.test.ts`

**Interfaces:**
- Produces: `mergeLines(aId: string, bId: string): void`. Task 7 (interstitial wiring)
  calls this.

- [ ] **Step 1: Write the failing tests**

Add to `apps/studio/src/store/documentSlice.test.ts`:

```ts
describe("mergeLines", () => {
  beforeEach(() => {
    useStudioStore.setState({
      video: { src: "/test.mp4", durationSec: 10, width: 1920, height: 1080 },
      lines: [
        {
          id: "a",
          start: 0,
          end: 2,
          words: [{ id: "w1", text: "hello", start: 0, end: 2 }],
        },
        {
          id: "b",
          start: 3,
          end: 5, // note the gap 2 -> 3, which merge must swallow
          words: [{ id: "w2", text: "world", start: 3, end: 5 }],
        },
      ],
      past: [],
      future: [],
    });
  });

  it("concatenates text and spans [a.start, b.end], swallowing the gap", () => {
    useStudioStore.getState().mergeLines("a", "b");
    const state = useStudioStore.getState();
    expect(state.lines).toHaveLength(1);
    expect(state.lines[0].id).toBe("a");
    expect(state.lines[0].start).toBe(0);
    expect(state.lines[0].end).toBe(5);
    expect(state.lines[0].words.map((w) => w.text)).toEqual(["hello", "world"]);
  });

  it("records undo under the 'Merge lines' label", () => {
    useStudioStore.getState().mergeLines("a", "b");
    expect(useStudioStore.getState().past[0].label).toBe("Merge lines");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/studio && bun test src/store/documentSlice.test.ts`
Expected: FAIL — `mergeLines` is not a function.

- [ ] **Step 3: Implement the action**

Add to the `createDocumentSlice` object, after `deleteLine`:

```ts
  mergeLines: (aId, bId) => {
    const state = get();
    const a = state.lines.find((l) => l.id === aId);
    const b = state.lines.find((l) => l.id === bId);
    if (!a || !b) return;

    state.commit("Merge lines");

    const text = [...a.words, ...b.words].map((w) => w.text).join(" ");
    const merged: SubtitleLine = {
      id: a.id,
      start: a.start,
      end: b.end,
      words: computeWordTimings(text, a.start, b.end),
    };

    const lines = state.lines.filter((l) => l.id !== bId).map((l) => (l.id === aId ? merged : l));
    set({ lines });
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/studio && bun test src/store/documentSlice.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/store/documentSlice.ts apps/studio/src/store/documentSlice.test.ts
git commit -m "feat(studio): add mergeLines store action"
```

---

## Task 6: Store action — `splitLine`

**Files:**
- Modify: `apps/studio/src/store/documentSlice.ts`
- Modify: `apps/studio/src/store/documentSlice.test.ts`

**Interfaces:**
- Produces: `splitLine(id: string, caretIndex: number): void`. Task 8 (editable row,
  ⌘↵ handler) calls this.

- [ ] **Step 1: Write the failing tests**

Add to `apps/studio/src/store/documentSlice.test.ts`:

```ts
describe("splitLine", () => {
  beforeEach(() => {
    useStudioStore.setState({
      video: { src: "/test.mp4", durationSec: 10, width: 1920, height: 1080 },
      lines: [
        {
          id: "a",
          start: 0,
          end: 4,
          // joined text: "hello there friend" (offsets: h=0, t=6, f=12)
          words: [
            { id: "w1", text: "hello", start: 0, end: 1 },
            { id: "w2", text: "there", start: 1, end: 2 },
            { id: "w3", text: "friend", start: 2, end: 4 },
          ],
        },
      ],
      past: [],
      future: [],
    });
  });

  it("splits at the nearest word boundary to the caret", () => {
    // caret at index 7 ("hello t|here friend") is nearest the boundary
    // after "hello" (index 5) vs after "there" (index 11) - nearest is 5.
    useStudioStore.getState().splitLine("a", 7);
    const state = useStudioStore.getState();
    expect(state.lines).toHaveLength(2);
    expect(state.lines[0].id).toBe("a");
    expect(state.lines[0].words.map((w) => w.text)).toEqual(["hello"]);
    expect(state.lines[1].words.map((w) => w.text)).toEqual(["there", "friend"]);
    // Contiguous: the split time is the shared boundary.
    expect(state.lines[0].end).toBe(state.lines[1].start);
    expect(state.lines[0].start).toBe(0);
    expect(state.lines[1].end).toBe(4);
  });

  it("no-ops when the caret is at the very start of the text", () => {
    useStudioStore.getState().splitLine("a", 0);
    expect(useStudioStore.getState().lines).toHaveLength(1);
  });

  it("no-ops when the caret is at the very end of the text", () => {
    const text = "hello there friend";
    useStudioStore.getState().splitLine("a", text.length);
    expect(useStudioStore.getState().lines).toHaveLength(1);
  });

  it("no-ops on a single-word line", () => {
    useStudioStore.setState({
      lines: [{ id: "a", start: 0, end: 2, words: [{ id: "w1", text: "hi", start: 0, end: 2 }] }],
    });
    useStudioStore.getState().splitLine("a", 1);
    expect(useStudioStore.getState().lines).toHaveLength(1);
  });

  it("records undo under the 'Split line' label", () => {
    useStudioStore.getState().splitLine("a", 7);
    expect(useStudioStore.getState().past[0].label).toBe("Split line");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/studio && bun test src/store/documentSlice.test.ts`
Expected: FAIL — `splitLine` is not a function.

- [ ] **Step 3: Implement the helper and the action**

Add to `apps/studio/src/store/documentSlice.ts`, above `createDocumentSlice`:

```ts
import type { SubtitleLine, Word } from "@captionly/engine";

/** Returns how many of `words` go in the first half after splitting at the
 *  boundary nearest `caretIndex` (an offset into words.map(w=>w.text).join(" ")).
 *  Returns -1 if there are fewer than two words (no boundary exists). */
function findNearestWordBoundary(words: Word[], caretIndex: number): number {
  if (words.length < 2) return -1;

  let offset = 0;
  const boundaries: number[] = [];
  for (const w of words) {
    offset += w.text.length;
    boundaries.push(offset); // offset right after this word's text
    offset += 1; // the joining space
  }

  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < words.length - 1; i++) {
    const dist = Math.abs(boundaries[i] - caretIndex);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best + 1;
}
```

Add to the `createDocumentSlice` object, after `mergeLines`:

```ts
  splitLine: (id, caretIndex) => {
    const state = get();
    const idx = state.lines.findIndex((l) => l.id === id);
    if (idx === -1) return;
    const line = state.lines[idx];

    const text = line.words.map((w) => w.text).join(" ");
    if (caretIndex <= 0 || caretIndex >= text.length) return;

    const splitAt = findNearestWordBoundary(line.words, caretIndex);
    if (splitAt < 1) return;

    const firstWords = line.words.slice(0, splitAt);
    const secondWords = line.words.slice(splitAt);
    const splitTime = firstWords[firstWords.length - 1].end;

    state.commit("Split line");

    const firstLine: SubtitleLine = {
      ...line,
      end: splitTime,
      words: computeWordTimings(firstWords.map((w) => w.text).join(" "), line.start, splitTime),
    };
    const secondLine: SubtitleLine = {
      id: crypto.randomUUID(),
      start: splitTime,
      end: line.end,
      words: computeWordTimings(secondWords.map((w) => w.text).join(" "), splitTime, line.end),
    };

    const lines = [...state.lines];
    lines.splice(idx, 1, firstLine, secondLine);
    set({ lines });
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/studio && bun test src/store/documentSlice.test.ts`
Expected: PASS, all tests in the file (this is the last store-action task — run the
whole file to confirm nothing earlier regressed).

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/store/documentSlice.ts apps/studio/src/store/documentSlice.test.ts
git commit -m "feat(studio): add splitLine store action"
```

---

## Task 7: Interstitial wiring — leading/trailing gaps, Add/Merge buttons

**Files:**
- Modify: `apps/studio/src/lines/Interstitial.tsx`
- Modify: `apps/studio/src/lines/LineList.tsx`

**Interfaces:**
- Consumes: `addLine`, `mergeLines` (Tasks 2, 5).
- Produces: `Interstitial` now takes
  `{ gapSec, gapStart, prevLineId, nextLineId }: { gapSec: number; gapStart: number; prevLineId: string | null; nextLineId: string | null }`.
  Task 11 (playhead-follow) touches the same `Rows` function next.

- [ ] **Step 1: Rewrite `Interstitial` with wired buttons**

Replace the contents of `apps/studio/src/lines/Interstitial.tsx`:

```tsx
import { memo } from "react";
import { voidHeight } from "./geometry";
import { useStudioStore } from "@/store";

interface InterstitialProps {
  gapSec: number;
  gapStart: number;
  prevLineId: string | null;
  nextLineId: string | null;
}

/**
 * The boundary between two lines (or before the first / after the last).
 * A butt joint renders as a hairline offering Merge only; a real gap renders
 * as a labelled dashed void offering Add line and, if both neighbours exist,
 * Merge. See spec §4.
 *
 * memo is load-bearing: Rows (LineList.tsx) re-renders at frame rate via
 * useActiveLineId, so every Interstitial in the list would otherwise
 * re-invoke on every frame.
 */
export const Interstitial = memo(function Interstitial({
  gapSec,
  gapStart,
  prevLineId,
  nextLineId,
}: InterstitialProps) {
  const addLine = useStudioStore((s) => s.addLine);
  const mergeLines = useStudioStore((s) => s.mergeLines);
  const canMerge = prevLineId !== null && nextLineId !== null;

  if (gapSec <= 0.001) {
    if (!canMerge) return <div aria-hidden className="ml-6 h-px bg-hairline" />;
    return (
      <button
        type="button"
        onClick={() => mergeLines(prevLineId, nextLineId)}
        aria-label="Merge lines"
        className="group ml-6 flex h-px w-[calc(100%-1.5rem)] items-center justify-center
                   bg-hairline transition-all hover:h-5 hover:bg-edit/30
                   focus-visible:h-5 focus-visible:outline-2 focus-visible:outline-offset-2
                   focus-visible:outline-edit"
      >
        <span className="hidden text-[0.625rem] text-edit group-hover:inline">Merge lines</span>
      </button>
    );
  }

  return (
    <div
      className="ml-6 flex items-center justify-center gap-3 rounded-sm border border-dashed border-hairline"
      style={{ height: voidHeight(gapSec) }}
    >
      <span className="tabular text-[0.6875rem] text-ink-muted">{gapSec.toFixed(2)}s free</span>
      <button
        type="button"
        onClick={() => addLine(prevLineId, gapStart, gapStart + gapSec)}
        className="rounded-sm border border-edit/50 px-2 py-0.5 text-[0.625rem] text-edit
                   transition-colors hover:bg-edit/10 focus-visible:outline-2
                   focus-visible:outline-offset-2 focus-visible:outline-edit"
      >
        Add line
      </button>
      {canMerge && (
        <button
          type="button"
          onClick={() => mergeLines(prevLineId, nextLineId)}
          className="rounded-sm border border-edit/50 px-2 py-0.5 text-[0.625rem] text-edit
                     transition-colors hover:bg-edit/10 focus-visible:outline-2
                     focus-visible:outline-offset-2 focus-visible:outline-edit"
        >
          Merge lines
        </button>
      )}
    </div>
  );
});
```

- [ ] **Step 2: Render leading/trailing gaps and remove the static empty state**

Modify `apps/studio/src/lines/LineList.tsx` — replace the `Rows` function body and
remove the `lines.length === 0` early return in `LineList`:

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
  const durationSec = useStudioStore((s) => s.video?.durationSec ?? 0);
  const activeId = useActiveLineId(playerRef);
  const activeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  const leadingGapSec = lines.length > 0 ? lines[0].start : durationSec;
  const trailingGapSec = lines.length > 0 ? durationSec - lines[lines.length - 1].end : 0;

  return (
    <>
      {(lines.length === 0 || leadingGapSec > 0.001) && (
        <Interstitial
          gapSec={leadingGapSec}
          gapStart={0}
          prevLineId={null}
          nextLineId={lines[0]?.id ?? null}
        />
      )}
      {lines.map((line, i) => (
        <Fragment key={line.id}>
          {i > 0 && (
            <Interstitial
              gapSec={line.start - lines[i - 1].end}
              gapStart={lines[i - 1].end}
              prevLineId={lines[i - 1].id}
              nextLineId={line.id}
            />
          )}
          <div ref={line.id === activeId ? activeRef : undefined}>
            <LineRow
              line={line}
              selected={line.id === selectedLineId}
              active={line.id === activeId}
              nextBoundary={lines[i + 1]?.start ?? durationSec}
              onSelect={onSelect}
              playerRef={playerRef}
            />
          </div>
        </Fragment>
      ))}
      {lines.length > 0 && trailingGapSec > 0.001 && (
        <Interstitial
          gapSec={trailingGapSec}
          gapStart={lines[lines.length - 1].end}
          prevLineId={lines[lines.length - 1].id}
          nextLineId={null}
        />
      )}
    </>
  );
}
```

Note the new `nextBoundary` prop on `LineRow` — this isn't consumed until Task 8, but
the type will be added there; TypeScript will flag it as an excess prop until then, which
is fine within this task (the plan builds it in the next task, per the spec's build
order — the app still runs since React ignores unknown props at runtime).

Then remove the empty-list early return in `LineList` (keep the `!video` branch):

```tsx
export function LineList({ playerRef }: { playerRef: React.RefObject<PlayerRef | null> }) {
  const video = useStudioStore((s) => s.video);
  const select = useStudioStore((s) => s.select);
  const beginEdit = useStudioStore((s) => s.beginEdit);

  // One click selects, seeks, AND begins editing - spec §5 "one click does everything".
  const onSelect = useCallback(
    (id: string) => {
      beginEdit(id);
      const line = useStudioStore.getState().lines.find((l) => l.id === id);
      if (line) playerRef.current?.seekTo(Math.round(line.start * FPS));
    },
    [beginEdit, playerRef],
  );

  if (!video) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-hairline bg-surface/50 p-8 text-center">
        <Film className="mb-3 h-8 w-8 text-ink-muted/50" />
        <p className="font-display text-sm font-medium text-ink">No video loaded</p>
        <p className="mt-1 max-w-xs text-xs text-ink-muted">
          Drop a video into the player rail or load the demo project to start spotting lines.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <Rows playerRef={playerRef} onSelect={onSelect} />
    </div>
  );
}
```

Note `onSelect` now calls `beginEdit` instead of `select` (per spec §5 — a click both
selects and opens editing; `beginEdit` already sets `selectedLineId` too). The unused
`select` import can stay unused for now — Task 11 (playhead-follow) uses it in `Rows`.
Remove the now-unused `lines` variable from `LineList` if your editor flags it (it's no
longer read directly in this component).

- [ ] **Step 3: Manually verify in the browser**

Run: `bun run dev:frontend` (or the project's existing dev script), load the demo video.
Confirm: the trailing gap after the last sample line shows "Ns free" and an "Add line"
button; clicking it inserts a new empty line (verify via Task 8 once editing lands — for
now just confirm a line with empty text appears at the right position, since the input
UI doesn't exist until Task 8). Confirm hovering the butt-joint hairline between the two
adjacent sample lines (if any share `end === start`) reveals "Merge lines" — the sample
fixture's lines are contiguous (line-1 ends at 5.0, line-2 starts at 5.0), so this should
be directly visible.

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/lines/Interstitial.tsx apps/studio/src/lines/LineList.tsx
git commit -m "feat(studio): wire interstitial Add line / Merge lines buttons"
```

---

## Task 8: Editable row — click-to-edit, Enter/Esc/⌘↵

**Files:**
- Modify: `apps/studio/src/lines/LineRow.tsx`
- Modify: `apps/studio/src/lib/constants.ts`

**Interfaces:**
- Consumes: `editLineText`, `splitLine`, `addLine` (Tasks 2, 6), `endEdit` (existing
  `editorSlice`), `nextBoundary` prop (Task 7).
- Produces: `LineRow` now takes an `editing: boolean` prop in addition to its existing
  props. Task 9 (retime fields, delete) and Task 11 (playhead-follow) build on this.

- [ ] **Step 1: Add the default line duration constant**

Modify `apps/studio/src/lib/constants.ts`:

```ts
/** Composition frame rate. Subtitle timings are in seconds and Remotion's
 *  <Video> syncs by time, so this sets animation granularity and export
 *  frame rate only — it does not need to match the source file's fps. */
export const FPS = 30;

/** Fixed duration for a line created via Enter-while-editing (not the
 *  interstitial's "Add line", which fills the whole visible gap instead -
 *  see spec §3's note on addLine's two callers). Clamped to the remaining
 *  gap by the caller. */
export const DEFAULT_LINE_DURATION = 3; // seconds
```

- [ ] **Step 2: Rewrite `LineRow` as editable**

Replace the contents of `apps/studio/src/lines/LineRow.tsx`:

```tsx
import { memo, useEffect, useRef, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import type { SubtitleLine } from "@captionly/engine";
import { useStudioStore } from "@/store";
import { formatTimecode } from "@/lib/timecode";
import { DEFAULT_LINE_DURATION } from "@/lib/constants";
import { lineHeight } from "./geometry";
import { RulerGutter } from "./RulerGutter";
import { WordStrip } from "./WordStrip";
import { Playhead } from "./Playhead";

interface LineRowProps {
  line: SubtitleLine;
  selected: boolean;
  active: boolean;
  nextBoundary: number;
  onSelect: (id: string) => void;
  playerRef: React.RefObject<PlayerRef | null>;
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
  nextBoundary,
  onSelect,
  playerRef,
}: LineRowProps) {
  const editingLineId = useStudioStore((s) => s.editingLineId);
  const editing = editingLineId === line.id;

  const editLineText = useStudioStore((s) => s.editLineText);
  const endEdit = useStudioStore((s) => s.endEdit);
  const splitLine = useStudioStore((s) => s.splitLine);
  const addLine = useStudioStore((s) => s.addLine);

  const [draft, setDraft] = useState(() => line.words.map((w) => w.text).join(" "));
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset the draft to the store's text whenever editing (re)starts, so
  // reopening a line after an undo (or a different line) doesn't show stale
  // text, and focus it (roadmap: one click selects, seeks, AND focuses text).
  useEffect(() => {
    if (editing) {
      setDraft(line.words.map((w) => w.text).join(" "));
      inputRef.current?.focus();
    }
    // Intentionally omit `line` from deps - only re-sync on an edit-mode transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, line.id]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      endEdit();
      return;
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      splitLine(line.id, e.currentTarget.selectionStart ?? 0);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      endEdit();
      const nextGapSec = nextBoundary - line.end;
      if (nextGapSec > 0.001) {
        const endAt = Math.min(line.end + DEFAULT_LINE_DURATION, line.end + nextGapSec);
        addLine(line.id, line.end, endAt);
      }
    }
  };

  return (
    <div className="flex gap-4">
      <RulerGutter selected={selected} />
      <div
        style={{ minHeight: lineHeight(line.end - line.start) }}
        className={`group relative flex w-full flex-col gap-2 rounded-md px-3 py-3
                    transition-colors ${selected ? "bg-raised" : "hover:bg-raised/50"}`}
      >
        <div className="flex items-baseline justify-between">
          <span className={`tabular text-xs ${active ? "text-now" : "text-ink-muted"}`}>
            {formatTimecode(line.start)}
          </span>
          <span className="tabular text-xs text-ink-muted">{formatTimecode(line.end)}</span>
        </div>

        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              editLineText(line.id, e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type the line…"
            className="w-full bg-transparent text-base leading-snug text-ink outline-none
                       placeholder:text-ink-muted"
          />
        ) : (
          <p
            role="button"
            tabIndex={0}
            aria-label={`Line ${formatTimecode(line.start)} to ${formatTimecode(line.end)}`}
            onClick={() => onSelect(line.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(line.id);
              }
            }}
            className={`cursor-text text-base leading-snug focus-visible:outline-2
                        focus-visible:outline-offset-2 focus-visible:outline-edit
                        ${active ? "text-now" : "text-ink"}`}
          >
            {line.words.length > 0 ? (
              line.words.map((w) => w.text).join(" ")
            ) : (
              <span className="text-ink-muted">Click to type…</span>
            )}
          </p>
        )}

        {selected && <WordStrip line={line} />}
        {active && <Playhead playerRef={playerRef} line={line} />}
      </div>
    </div>
  );
});
```

Note: the outer wrapper's `role="button"`/`tabIndex` moved onto the `<p>` (the text
display) rather than staying on the row container — nested interactives inside a button
role is broken accessibility, and Task 9 adds a delete button and two numeric fields
inside this same row.

- [ ] **Step 3: Manually verify in the browser**

Load the demo video. Click a line's text: confirm it becomes an input with the cursor
focused and the existing text present. Type a change and confirm the word strip
(visible since the line is selected) updates its word boundaries. Press `Esc`: confirm
it reverts to the `<p>` view but stays selected (word strip stays visible). Click again,
select all and delete the text, confirm it shows nothing (not "Click to type…" — that
placeholder only shows in the non-editing `<p>` view when `words` is empty, i.e. the
input's native `placeholder` attribute is what appears while actively editing an empty
line). Test ⌘↵ mid-line: confirm the line splits into two at the nearest word boundary
and undo (⌘Z) restores the original single line. Test Enter at the end of a line that
has free time after it (e.g. click "Add line" on the trailing gap first, then type text
and press Enter): confirm a new 3s line appears in edit mode.

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/lines/LineRow.tsx apps/studio/src/lib/constants.ts
git commit -m "feat(studio): make LineRow editable (click, Enter, Esc, cmd-enter split)"
```

---

## Task 9: In/Out numeric fields and delete

**Files:**
- Create: `apps/studio/src/lines/TimecodeField.tsx`
- Modify: `apps/studio/src/lines/LineRow.tsx`

**Interfaces:**
- Consumes: `formatTimecode`, `parseTimecode` (both already exist in
  `apps/studio/src/lib/timecode.ts` — do not reimplement), `setLineIn`, `setLineOut`
  (Task 3), `deleteLine` (Task 4).
- Produces: `TimecodeField({ value: number; onCommit: (seconds: number) => void }): JSX.Element`.

- [ ] **Step 1: Create the `TimecodeField` component**

Create `apps/studio/src/lines/TimecodeField.tsx`:

```tsx
import { useEffect, useState } from "react";
import { formatTimecode, parseTimecode } from "@/lib/timecode";

interface TimecodeFieldProps {
  value: number;
  onCommit: (seconds: number) => void;
}

/**
 * A tabular-mono timecode input. Commits on blur or Enter, never per
 * keystroke — so typing "1" then "12" doesn't fight a neighbour clamp
 * mid-entry (the clamping itself lives in the store action passed as
 * onCommit). An invalid parse reverts the field without committing.
 */
export function TimecodeField({ value, onCommit }: TimecodeFieldProps) {
  const [draft, setDraft] = useState(() => formatTimecode(value));

  // Keep the field in sync when the store's value changes from elsewhere
  // (undo, a neighbour's retime clamping this line) while unfocused.
  useEffect(() => {
    setDraft(formatTimecode(value));
  }, [value]);

  const commit = () => {
    const parsed = parseTimecode(draft);
    if (parsed === null) {
      setDraft(formatTimecode(value));
      return;
    }
    onCommit(parsed);
  };

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setDraft(formatTimecode(value));
          e.currentTarget.blur();
        }
      }}
      className="tabular w-16 rounded-sm bg-transparent text-xs text-ink-muted outline-none
                 focus-visible:text-ink"
    />
  );
}
```

- [ ] **Step 2: Wire `TimecodeField` and a delete button into `LineRow`**

Modify `apps/studio/src/lines/LineRow.tsx`:

Add imports:

```tsx
import { Trash2 } from "lucide-react";
import { TimecodeField } from "./TimecodeField";
```

Add hooks alongside the existing ones:

```tsx
  const setLineIn = useStudioStore((s) => s.setLineIn);
  const setLineOut = useStudioStore((s) => s.setLineOut);
  const deleteLine = useStudioStore((s) => s.deleteLine);
```

Replace the timecode row (the `<div className="flex items-baseline justify-between">`
block) with:

```tsx
        <div className="flex items-baseline justify-between gap-2">
          {selected ? (
            <TimecodeField value={line.start} onCommit={(v) => setLineIn(line.id, v)} />
          ) : (
            <span className={`tabular text-xs ${active ? "text-now" : "text-ink-muted"}`}>
              {formatTimecode(line.start)}
            </span>
          )}
          {selected ? (
            <TimecodeField value={line.end} onCommit={(v) => setLineOut(line.id, v)} />
          ) : (
            <span className="tabular text-xs text-ink-muted">{formatTimecode(line.end)}</span>
          )}
          {selected && (
            <button
              type="button"
              aria-label="Delete line"
              onClick={() => deleteLine(line.id)}
              className="text-ink-muted opacity-0 transition-opacity hover:text-edit
                         group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
```

- [ ] **Step 3: Manually verify in the browser**

Select a line: confirm the two plain timecode spans become editable inputs pre-filled
with the current In/Out. Type a new Out time within range and press Enter: confirm the
line resizes and the word strip recomputes. Type an Out time past the next line's start:
confirm it clamps to the next line's start on commit rather than overlapping. Type
garbage (e.g. "abc") and blur: confirm the field reverts to the last valid value with no
undo entry recorded. Hover a selected row: confirm a trash icon fades in; click it and
confirm the line is deleted and selection clears.

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/lines/TimecodeField.tsx apps/studio/src/lines/LineRow.tsx
git commit -m "feat(studio): add In/Out retime fields and delete button to LineRow"
```

---

## Task 10: Delete via keyboard

**Files:**
- Modify: `apps/studio/src/app/StudioShell.tsx`

**Interfaces:**
- Consumes: `deleteLine`, `selectedLineId`, `editingLineId` (Task 4, existing
  `editorSlice`).

- [ ] **Step 1: Extend the existing global keydown listener**

Modify `apps/studio/src/app/StudioShell.tsx` — replace the `onKey` handler inside the
existing `useEffect`:

```tsx
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const inTextField =
        !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        if (inTextField) return; // let text fields keep their native field-level undo
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      if ((e.key === "Backspace" || e.key === "Delete") && !inTextField) {
        const state = useStudioStore.getState();
        if (state.selectedLineId && !state.editingLineId) {
          e.preventDefault();
          state.deleteLine(state.selectedLineId);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);
```

- [ ] **Step 2: Manually verify in the browser**

Select a line (click it, then press `Esc` so it's selected but not editing). Press
`Backspace`: confirm the line is deleted. Confirm pressing `Backspace` while actively
typing in a line's text input does NOT delete the line (it edits the text normally).
Confirm `⌘Z` still undoes/redoes as before.

- [ ] **Step 3: Commit**

```bash
git add apps/studio/src/app/StudioShell.tsx
git commit -m "feat(studio): delete the selected line with Backspace/Delete"
```

---

## Task 11: Playhead-follow (two-way sync)

**Files:**
- Modify: `apps/studio/src/lines/LineList.tsx`

**Interfaces:**
- Consumes: `select` (existing `editorSlice`), `editingLineId` (existing `editorSlice`),
  `useActiveLineId` (existing, `apps/studio/src/lines/Playhead.tsx`).

- [ ] **Step 1: Add the follow effect to `Rows`**

Modify `apps/studio/src/lines/LineList.tsx` — in `Rows`, add the `select` and
`editingLineId` subscriptions and a second effect alongside the existing auto-scroll one:

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
  const editingLineId = useStudioStore((s) => s.editingLineId);
  const select = useStudioStore((s) => s.select);
  const durationSec = useStudioStore((s) => s.video?.durationSec ?? 0);
  const activeId = useActiveLineId(playerRef);
  const activeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  // Playback drives selection (two-way sync, spec §8) - but never while a
  // different line is being actively edited, so playback can't steal focus
  // from someone typing. select() is a pure state setter; the seek-on-select
  // behavior stays in LineList's onSelect below, so this never triggers a seek.
  useEffect(() => {
    if (activeId && editingLineId === null) select(activeId);
  }, [activeId, editingLineId, select]);

  // ...rest unchanged from Task 7 (leadingGapSec/trailingGapSec and the JSX)
```

- [ ] **Step 2: Manually verify in the browser**

Load the demo video with its multi-line fixture. Press play with no line selected:
confirm the transcript highlights and scrolls to follow the active line as playback
advances, and the word strip pops open on whichever line is currently playing (this is
the accepted consequence noted in spec §8, not a bug). While playing, click a line to
start editing its text: confirm playback continues but no longer yanks the selection
away from the line you're editing. Press `Esc` to stop editing: confirm playback-follow
resumes on the next line change.

- [ ] **Step 3: Commit**

```bash
git add apps/studio/src/lines/LineList.tsx
git commit -m "feat(studio): playhead drives line selection during playback"
```

---

## Final Verification

- [ ] Run the full test suite: `cd apps/studio && bun test` and `cd packages/engine && bun test` — all pass.
- [ ] Run lint/typecheck per the project's existing scripts (check `package.json` for the
      exact command, e.g. `bun run lint` / `bun run build`) — 0 errors.
- [ ] Full manual pass in the browser against spec §9: primary scenario (edit a
      pre-populated multi-line fixture — edit text, merge across a real gap, split via
      ⌘↵, delete via icon and keyboard, retime via fields with neighbour clamping, click
      select+seek, playback-follow without stealing edit focus, undo/redo across all of
      the above), then the fallback cold-start flow (empty list, type → Enter →
      type → Enter... to a fully spotted transcript with no mouse).

## Self-Review Notes

- **Spec coverage:** §2 (Task 1), §3 (Tasks 2–6), §4 (Task 7), §5 (Task 8), §6 (Task 9),
  §7 (Tasks 9–10), §8 (Task 11), §9 (woven into each task's manual-verification step plus
  Final Verification), §10 (this plan's task order matches exactly), §11 (nothing in this
  plan touches autotranscription, file import, per-word overrides, drag-handle retiming,
  or mobile — confirmed no task introduces them).
- **No placeholders:** every step above has literal, runnable code — none deferred to
  "similar to Task N" or left as prose-only instructions.
- **Type consistency:** `addLine(afterLineId, startAt, endAt)` matches across Task 2's
  interface declaration, Task 2's implementation, Task 7's Interstitial call site, and
  Task 8's Enter handler. `nextBoundary` is introduced on `LineRow`'s props in Task 7's
  `Rows` call site and consumed starting Task 8 — the one deliberate task-boundary gap,
  called out explicitly in Task 7's step 2 so it isn't mistaken for an oversight.
