# Frontend Revamp — Program Roadmap

**Created:** 2026-09-02
**Status:** sub-projects 1 & 2 complete; 3 specced (line editor, in progress); 4 not yet specced
**Scope:** `apps/studio` (with narrow, named exceptions in `packages/engine`)

This is the program-level document for the frontend revamp. Each sub-project gets its
own design spec and implementation plan under `docs/superpowers/specs/` and
`docs/superpowers/plans/`; this file records what the whole program is, the decisions that
bind all of it, and the agreed behaviour that has not yet reached a sub-project spec.

Its reason for existing: several decisions below were settled in conversation and lived
nowhere else. A decision that survives only in a chat log is a decision you get to make
twice.

---

## 1. What we are building

An editor where you bring your own video and your own subtitle lines, type them against
the footage, spot their timings, and style animated captions — then export.

**Deliberately not building:** subtitle file import (SRT/VTT/JSON). **Autotranscription is
planned** as a future sub-project (not yet scheduled or speced) — decided 2026-09-05,
reopening the original "user types lines only" decision below. Lines may arrive already
populated (from autotranscription or any other source) or be typed manually; the editor
must support both, with free editing of a pre-populated transcript as the primary
scenario and manual typing as the fallback (see §2, and SP3's spec).

The starting point was a demo harness: one route, a hardcoded video path, hardcoded sample
subtitles, and no editor of any kind.

---

## 2. Cross-cutting decisions

These are settled and apply to every sub-project. Changing one is a program-level decision,
not a sub-project one.

| Decision | Consequence |
|---|---|
| **Styling is global only.** One `SubtitleStyle` for the whole project, with a deep control surface rather than per-line overrides. | `SubtitleStyle` stays a flat object; `packages/engine` types are untouched; the line editor is purely text and timing. |
| **Any aspect ratio, derived from the uploaded file.** | Style values must become resolution-independent — SP2's work, touching `SubtitleOverlay`, `subtitleDrawer`, and `SafeZones`. |
| **Lines may arrive already populated (autotranscription, planned) or be typed manually.** No SRT/VTT/JSON import. | SP3's primary designed-and-tested scenario is free editing (edit text, merge, split, delete, retime) of a set of lines that already exists. Manual keyboard-driven typing from an empty list remains supported as a fallback, not the showcased flow. Autotranscription itself is not yet speced. |
| **Word timings are computed, never typed.** Character-weighted distribution, punctuation pause bonuses, a per-word minimum, normalized to fill the line's range exactly. | The algorithm is the single source of word timings. The word strip exists so its output is visible and checkable. |
| **No per-word timing nudging.** | Revisit only if the algorithm proves insufficient in practice. |
| **Server render is the source of truth for export.** | The client WebCodecs path must be gated or labelled to what it can honestly render (see §6). |
| **Dark is the only theme.** | The palette lives in `:root`; nothing toggles. A light theme would be new work, not a config flip. |

---

## 3. Design direction

Full detail in `specs/2026-08-31-studio-shell-and-document-store-design.md` §4–5. In brief:

The subject is broadcast subtitling; the industry term for placing subtitle timings is
**spotting**, and that anchors the vocabulary. The interface is organized around *time*
rather than around objects, and timecode is a first-class typographic element.

- **Palette** — deep desaturated blue-black surfaces. Two accents, each with exactly one
  meaning: **amber = now** (playhead, active line), **violet = edit affordance** (merge,
  add, split, focus rings). Gaps get no colour; silence renders as absence.
- **Type** — Bricolage Grotesque (display), Archivo (UI), IBM Plex Mono with tabular
  figures (every timecode and numeric field). Tabular is a requirement, not a preference:
  timecodes sit in aligned columns and must not shift width as digits change.
- **Layout** — two columns. Sticky player rail whose width follows the video's aspect
  ratio; a work surface tabbed `Lines ⇄ Style`. Not three columns: a permanent style
  column would compress the transcript and destroy its rhythm, and styling and line entry
  are different modes of work.
- **The signature bet: there is no bottom timeline.** The transcript *is* the timeline,
  rotated 90°. A ruler gutter runs down the left edge, line blocks are proportional to
  duration (clamped 72–200px), gaps render as labelled voids, and the playhead sweeps the
  active row. This removes a UI region every competitor has.

---

## 4. The four sub-projects

Ordered so the app runs at every step and no UI is built twice. The visual pass is
deliberately **first**, not last — building the line editor and then redesigning it is
double work.

### Branching & Delivery: Stacked PR Strategy

We are delivering the revamp using a **stacked pull request (stacked PR)** strategy so each
sub-project has an isolated, reviewable diff without waiting for upstream merges:

1. **PR 1 (SP1):** `main` ← `feat/studio-shell-and-document-store` *(Open — created and managed manually by user)*
2. **PR 2 (SP2):** `feat/studio-shell-and-document-store` ← `feat/studio-video-in` *(Open — created and managed manually by user)*
3. **PR 3 (SP3):** `feat/studio-video-in` ← `feat/studio-line-editor` *(Upcoming)*
4. **PR 4 (SP4):** `feat/studio-line-editor` ← `feat/studio-style-system` *(Upcoming)*

> [!NOTE]
> **Manual PR Management:** All GitHub pull requests are created, retargeted, and updated manually by the user. Agents branch from the head of the preceding sub-project and focus purely on local implementation, testing, and documentation.

---

### SP1 — Shell + document store ✅ COMPLETE

Visual language, `zustand` store in three slices, snapshot undo/redo with edit coalescing,
selection, the two-column layout frame, and removal of 786 lines of dead pre-Remotion
player code.

- Spec: `specs/2026-08-31-studio-shell-and-document-store-design.md`
- Plan: `plans/2026-08-31-studio-shell-and-document-store.md`
- Branch: `feat/studio-shell-and-document-store` (18 commits, pushed)
- PR: Open to `main` (PR 1)
- Gates at completion: lint 0 errors, build passes uncached, 17 tests pass.
- **Outstanding:** manual browser verification — playback, the playhead sweep,
  click-to-seek, `⌘Z`, focus rings, reduced motion, export, and the React DevTools
  **Profiler re-render check**. The build environment had no browser tooling. The
  re-render architecture has been verified by reading code, never by watching it run.

### SP2 — Video in ✅ COMPLETE

The user's own file drives the editor, at whatever shape it is. Upload → object URL,
metadata extraction, composition dimensions derived from the file, resolution-independent
style scaling, safe zones, and empty states with demo mode.

- Spec: `specs/2026-09-05-video-in-design.md`
- Plan: `plans/2026-09-05-video-in.md`
- Branch: `feat/studio-video-in`
- PR: Open to `feat/studio-shell-and-document-store` (PR 2)
- All exit criteria met (fixture deleted, dynamic resolution scaling, in-place dropzone & demo mode, 37 passing tests).

### SP3 — Line editor

**Goal:** the transcript becomes editable. This is the largest sub-project.

- Add, edit, delete, merge, split, retime.
- The **word-timing algorithm** (§2) and its test.
- Two-way player sync, keyboard-first entry.
- The interstitial's controls, which SP1 built in visual form only.

**Exit criteria:** a user can go from an uploaded video and an empty list to a fully spotted
set of lines without touching a mouse more than incidentally.

Agreed interaction rules are in §5 — read those before speccing this.

### SP4 — Style system

**Goal:** "style them extensively" delivered.

- Rework `StylePanel` and `AnimationPanel` onto shadcn components. They are currently raw
  `<select>`, `<input type=range>`, and `<input type=color>` despite the full library being
  installed.
- Presets.
- The expanded style surface the global-only decision bought us — gradients, per-word
  emphasis treatments, outline/glow/shadow stacks.

**Entry note:** SP1 wired `commit()` into the style handlers with a single coalesce key per
surface (`"style"`, `"animation"`), so a slider drag collapses into one undo entry. Once the
panels are reworked, key per-property instead, so two deliberate tweaks inside 600ms stop
merging.

---

## 5. Agreed line-editor behaviour (SP3)

**These were settled in conversation and are recorded here because they existed nowhere
else.** They are decisions, not suggestions — spec SP3 against them.

**The interstitial is gap-aware.** The affordance between two lines offers only what is
actually possible there:

- **Butt joint** (gap ≈ 0, tolerance `0.001`) → renders as a hairline. Offers **Merge** only.
- **Real gap** → renders as a labelled dashed void whose height is proportional to the gap
  (clamped 24–120px). Offers **Add line · Ns free** *and* **Merge**.
- **After the last line** → the same object, shown only when `lastLine.end < duration`,
  labelled with the remaining time.

Silence therefore has physical presence in the list, and the divider itself encodes whether
time is free there.

**Selection and editing:**

- **One click does everything** — selects the line, seeks the player to its In point, and
  focuses the text for editing. `Esc` leaves editing and keeps selection. It is a text-first
  tool; a double-click gate would only add friction.
- **Split via caret:** while editing, `⌘↵` splits the line at the cursor, dividing time at
  the nearest computed word boundary. No button, no separate mode.
- **Merge** concatenates the two lines' text and spans `[a.start, b.end]`, swallowing any
  gap between them. Word timings recompute across the whole new range.
- **Timecode edits clamp at neighbours.** Dragging line 3's Out past line 4's In stops at
  the boundary. Merge is the explicit way to combine — dragging must never silently destroy
  a line.
- The **word strip** is read-only. It exists to make the computed timings inspectable, not
  editable (§2).

**Copy vocabulary** (fixed, so later work stays consistent): a unit of subtitle is a
**line** — never "caption", "cue", or "segment". Timecodes are **In** and **Out**. Actions
keep their name through the flow: the control says *Merge lines*, the undo entry says
"Merge lines".

---

## 6. Carried-forward debts and warnings

| Item | Where it bites |
|---|---|
| **`subtitleDrawer.ts` ignores `animation` entirely.** 146 lines against 9 engine animation components — it draws a single hardcoded active-word highlight, so all nine animations export incorrectly via the client WebCodecs path. **Pre-existing, not caused by this program.** | Any sub-project that widens the style surface widens this gap. Server render is the source of truth; the client path needs gating or honest labelling. |
| **`SP1_FIXTURE` aliases the engine's exported singletons by reference** (`sampleSubtitles`, `defaultStyle`, …). Safe while every action is immutable. | **SP3.** Any in-place line mutation would corrupt the shared engine export across every future document reset. The "updates must be immutable" constraint is the protection. |
| **`Rows` shares one `activeRef` across conditionally-rendered divs.** Correct only because React detaches refs in the mutation phase and attaches in the layout phase, so the new node's attach wins. | SP3, when the row structure changes. Works, but subtle enough to break accidentally. |
| **`useActiveLineId` does an O(N) `lines.find` per frame.** Fine at current scale. | SP3, once lists get long. Measure before optimizing. |
| **Profiler verification debt.** The re-render architecture's central claim has never been observed in a browser. | Before SP2 builds on it. See SP1's outstanding items. |
| **`bun run dev:frontend` does not start on Node 21.6.0.** Vite 7 needs 20.19+ or 22.12+; Node 21.x lacks `crypto.hash`. Pre-existing and unrelated to this program. | Immediately, for anyone running the app. Pin Node 22.x. |

---

## 7. Explicitly out of scope for the whole program

Subtitle file import (SRT/VTT/JSON) · per-line or per-word style overrides · per-word
timing nudging · a light theme · mobile/touch optimization of the line editor (it is a
desktop tool; the shell degrades to stacked below `md`) · persistence to disk or server
(the document lives in memory).

Each of these is a decision recorded in §2, not an oversight. Reopening one is a
program-level conversation.

**Autotranscription** is no longer on this list — reopened 2026-09-05 as planned future
work (see §1, §2). It is not yet scheduled or speced; SP3 is designed so lines may arrive
from any source, autotranscription included, without further rework.
