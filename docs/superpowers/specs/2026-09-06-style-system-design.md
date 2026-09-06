# SP4 — Style System — Design

**Date:** 2026-09-06
**Status:** design approved, spec written
**Branch:** `feat/studio-style-system` (branches from the head of `feat/studio-line-editor`)
**Scope:** `apps/studio/src/subtitle/` (`StylePanel.tsx`, `AnimationPanel.tsx`, new `PresetPicker.tsx`),
`apps/studio/src/app/WorkSurface.tsx`, `apps/studio/src/export/` (new `exportCapability.ts`,
`subtitleDrawer.ts` read but not rewritten), `packages/engine/src/types.ts`,
`packages/engine/src/sampleData.ts`, `packages/engine/src/utils/textStyle.ts` (new),
`packages/engine/src/presets.ts` (new), `packages/engine/src/animations/*.tsx` (all 9)

---

## 1. Goal

"Style them extensively," delivered — see `docs/superpowers/ROADMAP-frontend-revamp.md` §4
(SP4). Three things, in one sub-project because they share the same two panels and the same
`SubtitleStyle`/`AnimationConfig` types:

1. Rework `StylePanel`/`AnimationPanel` onto shadcn components — they are currently raw
   `<select>`, `<input type=range>`, and `<input type=color>` despite the full library being
   installed.
2. Built-in curated presets (style + animation bundles).
3. The expanded style surface the global-only styling decision (roadmap §2) bought us:
   text gradients, a richer active-word glow, and a fuller outline/glow/shadow control set.

This spec implements against roadmap §2/§4, not redecide them. Styling stays global-only —
nothing here introduces per-line or per-word manual overrides.

---

## 2. `SubtitleStyle` type changes

All new fields are **required, non-optional**, following the existing flat, fully-populated
shape of `SubtitleStyle` (no nested descriptor objects introduced):

| Field | Type | Default | Purpose |
|---|---|---|---|
| `shadowColor` | `string` | `"#000000"` | Base shadow/glow color when the word is *not* active. Replaces the `"rgba(0,0,0,0.8)"` literal currently hardcoded (inconsistently) in 4 of the 9 animation components. |
| `shadowOffsetX` | `number` | `0` | Shadow horizontal offset, px. |
| `shadowOffsetY` | `number` | `0` | Shadow vertical offset, px. |
| `textGradientEnabled` | `boolean` | `false` | Turns text fill from flat `color` into a gradient. `false` reproduces today's rendering exactly. |
| `textGradientTo` | `string` | copy of `activeColor` | Gradient's second stop. First stop is the existing `color` field — no redundant "from" field. |
| `textGradientAngle` | `number` | `90` | Gradient sweep angle, degrees (90 = left-to-right). |
| `activeGlowMultiplier` | `number` | `1` | Multiplies `shadowBlur` only while a word is active — the "richer active-word treatment." `1` = no change from today. |

Also: `stroke` (color) already exists on `SubtitleStyle` since SP1 but has never had a UI
control — `StylePanel` gains a "Stroke color" row for it. No type change, just wiring.

`defaultStyle` in `packages/engine/src/sampleData.ts` gets the new fields with the defaults
above. `historySlice.test.ts` and any other test constructing a full `SubtitleStyle` literal
need the new fields added (compile-time enforced, since they're non-optional).

**Behavioral note:** today, shadow color varies by component — `ColorFillAnimation`,
`PopOnAnimation` switch to `activeColor` only while active; `WipeAnimation` always uses
`activeColor`; `TypewriterAnimation` never varies. Centralizing via §3 makes this consistent
across all 9: shadow color is `activeColor` while active, `shadowColor` otherwise. This is a
deliberate small visual fix riding along with the centralization, not a silent regression —
worth calling out during review.

---

## 3. Shared style-resolution helper (root-cause fix for the duplication)

New pure function, `packages/engine/src/utils/textStyle.ts`:

```ts
function resolveWordCss(style: SubtitleStyle, isActive: boolean): React.CSSProperties
```

Returns the merged CSS for a rendered word: fill (flat `color`, or `backgroundImage` +
`backgroundClip: "text"` + `WebkitTextFillColor: "transparent"` when `textGradientEnabled`),
stroke (`stroke`/`strokeWidth`), and shadow (`shadowColor`/`activeColor`, `shadowBlur *
(isActive ? activeGlowMultiplier : 1)`, `shadowOffsetX/Y`) — composed into a single
`textShadow`/paint-order block.

All 9 files in `packages/engine/src/animations/` (`ColorFillAnimation`, `PopOnAnimation`,
`TypewriterAnimation`, `WipeAnimation`, `RollUpAnimation`, `PaintOnAnimation`,
`FlapBoardAnimation`, `TickerAnimation`, `DigitalMatrixAnimation`) replace their inline
`paintOrder`/`textShadow` blocks with `resolveWordCss(style, isActive)`. This is the direct
fix for the duplicated, inconsistent inline CSS found while reading them — one place computes
"what does a word actually look like," which §7 (export gating) also depends on.

---

## 4. Presets

New `packages/engine/src/presets.ts`, mirroring the existing `ANIMATION_LABELS` /
`defaultOptionsFor` pattern already in the engine:

```ts
type StylePreset = { label: string; style: SubtitleStyle; animation: AnimationConfig };
const PRESETS: Record<string, StylePreset>;
```

6–8 curated presets (e.g. "Bold Karaoke," "Clean Minimal," "Neon"). New
`apps/studio/src/subtitle/PresetPicker.tsx` renders them as a row of buttons above
`AnimationPanel`/`StylePanel` in the Style tab — it sets both panels' state at once, so it
can't live inside either. Clicking applies the whole preset via the existing `setStyle`
(a full object works fine as the "patch," since it covers every key) and `setAnimation`,
wrapped in one `commit("Apply preset")` (no coalesce key needed — a click is already a
discrete action, not a drag). No store changes required.

Built-in only, no save/custom-preset feature — descoped per program decision to keep this a
same-session, no-persistence feature (roadmap §7 already excludes disk/server persistence).

---

## 5. Panel rework (shadcn)

Mechanical control swap, same fields, same layout groupings as today:

| Today | Becomes |
|---|---|
| `<select>` (font family, weight, box anchor, safe zone) | shadcn `Select` |
| `<input type=range>` (size, stroke width, active scale, shadow blur, box width, background opacity/radius/padding, new offset/angle/multiplier fields) | shadcn `Slider` |
| `<input type=color>` (color, active color, bg color, new stroke/shadow/gradient colors) | shadcn `Popover` containing the native color input (swatch button trigger) + a hex `Input` for typed entry — no color-picker dependency exists in shadcn or the installed package set, and none is added |

`AnimationPanel`'s animation-type control stays a `Select` (9 options; a chip grid was
considered and rejected — see §8, no preview affordance to justify the extra chrome).

---

## 6. Coalesce-key granularity (roadmap SP4 entry note)

Today `WorkSurface.tsx` uses one `coalesceKey: "style"` for every style field and one
`"animation"` for every animation field — so two unrelated slider drags within 600ms merge
into a single undo step. `StylePanel`/`AnimationPanel`'s `onChange` contract changes from
"here's the whole next object" to "here's the one field that changed":

```ts
// StylePanel / AnimationPanel props
onFieldChange: <K extends keyof SubtitleStyle>(key: K, value: SubtitleStyle[K]) => void;
```

`WorkSurface` builds the coalesce key per field and merges:

```ts
const changeStyleField = <K extends keyof SubtitleStyle>(key: K, value: SubtitleStyle[K]) => {
  commit("Change style", { coalesceKey: `style:${String(key)}` });
  setStyle({ [key]: value } as Partial<SubtitleStyle>);
};
```

Same pattern for animation *options* (`` `animation:${type}:${key}` ``). Animation *type*
switches stay a single uncoalesced commit (a full-replace action, not a continuous drag) —
unchanged from today's behavior.

---

## 7. Export gating

New `apps/studio/src/export/exportCapability.ts` — studio-side (not engine), since it
encodes what one specific renderer, `subtitleDrawer.ts`, can honestly draw:

```ts
function isClientExportSupported(style: SubtitleStyle, animation: AnimationConfig):
  { supported: boolean; reason?: string }
```

Reading `subtitleDrawer.ts` (the client WebCodecs canvas renderer) confirms it already
hardcodes one look — word-by-word reveal by time, flat fill, single shadow color — regardless
of `animation.type`. It was already wrong for 8 of 9 animation types before this sub-project
(pre-existing debt, roadmap §6). The honest check:

```
supported = animation.type === "colorFill"
  && animation.options.transition === "hardCut"
  && !style.textGradientEnabled
```

When `supported` is `false`, the export control shows a label ("this look renders accurately
only via server export") rather than exporting a silently-wrong client video. `subtitleDrawer.ts`
itself is **not** rewritten to support the new features — server render remains the source of
truth (roadmap §2).

---

## 8. Motion & polish

Color/type tokens are locked program-wide (roadmap §2/§3) — untouched here. Scope is
interaction polish on the panels this sub-project touches, and one thing was deliberately
**cut** after review: a live preview stage with hover-preview-before-commit. Rejected because
the main player already shows real, playhead-synced preview, and cheap undo/redo removes any
need to "try before committing" — it would have been added complexity with no real gain, and
would have justified making the animation-type control a chip grid it doesn't otherwise need
to be (§5 keeps it a plain `Select`).

What ships:

- Color swatch buttons: `scale-105` on hover, violet focus ring when the popover opens
  (reusing the existing violet = edit-affordance meaning, not inventing a new one).
- Slider thumbs: violet-tinted, a small `scale` bump only while `data-[state=dragging]`.
- Applying a preset changes many fields at once — a single ~150ms opacity pulse across the
  Style tab content marks it as one coherent change rather than a jarring snap.
- All of the above respects `prefers-reduced-motion: reduce` (drops to instant, no
  transition) — carries forward the reduced-motion requirement noted as outstanding since SP1.

No other new animation.

---

## 9. Testing

- **Engine unit tests** (new, following the existing `wordTiming.test.ts` pattern):
  - `resolveWordCss`: gradient on/off produces the right fill properties; shadow color
    switches on `isActive`; `activeGlowMultiplier` scales blur only while active.
  - `isClientExportSupported`: matrix of animation type × transition × gradient-enabled,
    confirming only the one already-hardcoded combination reports supported.
  - `PRESETS`: every entry is a structurally valid `SubtitleStyle`/`AnimationConfig` (every
    required key present) — a shape check, not a snapshot of visual values.
- **Manual browser verification** (this sub-project is UI-heavy, like SP1/SP3): every
  reworked control in both panels, the new color popovers, preset apply (visual pulse +
  single undo step), per-field coalescing (two different sliders within 600ms produce two
  undo steps, not one), the export-gating label appearing/disappearing as style/animation
  change, and `prefers-reduced-motion` actually suppressing the new transitions.

---

## 10. Build order

Keeps the app running at every step.

1. `SubtitleStyle` type changes + `defaultStyle` update + fix now-broken literals (engine,
   no UI dependents yet).
2. `resolveWordCss` + test; wire into all 9 animation components (one shared helper, replaces
   duplicated inline CSS).
3. Expose `stroke` color in `StylePanel`; add controls for the new fields (still raw HTML,
   not yet reworked — keeps steps independently testable).
4. Panel rework onto shadcn (§5) + per-field coalesce keys (§6) together, since both touch
   the same `onChange` contract.
5. `PresetPicker` + `PRESETS` registry + apply-pulse motion.
6. `isClientExportSupported` + export-button label.
7. Remaining motion polish (color-swatch hover, slider-thumb drag state) + reduced-motion
   guard pass over all of it.

---

## 11. Branching & PR

Per roadmap "Branching & Delivery: Stacked PR Strategy": branch `feat/studio-style-system`
off the current head of `feat/studio-line-editor`. This is **PR 4** in the stack:
`feat/studio-line-editor` ← `feat/studio-style-system`. As with PRs 1–3, the PR itself is
created, retargeted, and managed manually by the user — implementation here branches from
the head of the preceding sub-project and focuses purely on local implementation, testing,
and documentation.

---

## 12. Out of scope

Background-box gradients (text-fill only, per review), per-line/per-word manual style
overrides (styling stays global-only, roadmap §2), multi-layer shadow stacks (one enriched
glow, not an array of layers), user-saved/custom presets (built-in only), rewriting
`subtitleDrawer.ts` to actually render the expanded style surface (gating/labeling only,
server render stays the source of truth), the live preview stage and hover-preview (cut in
review — see §8), mobile/touch optimization (desktop tool, unchanged program-wide decision).
