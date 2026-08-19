## Goal

Extend the subtitle editor to support a pluggable animation system with the V1 animation types: **Color Fill**, **Typewriter**, **Roll-Up**, and **Paint-On**. Architecture must keep the renderer pure (deterministic from `time + state`) so it stays reusable for server-side frame export. V2 animations (Pop-On, Wipe, Flap Board, Ticker, Digital Matrix) will be scaffolded as registry slots but not implemented yet.

## Architecture

Refactor `src/subtitle/renderer.ts` from a single hardcoded renderer into an **animation strategy registry**:

```text
SubtitleRenderer (orchestrator)
   └─ AnimationStrategy (interface)
        ├─ ColorFillStrategy        ← V1
        ├─ TypewriterStrategy       ← V1
        ├─ RollUpStrategy           ← V1
        ├─ PaintOnStrategy          ← V1
        ├─ PopOnStrategy            ← V2 stub
        ├─ WipeStrategy             ← V2 stub
        ├─ FlapBoardStrategy        ← V2 stub
        ├─ TickerStrategy           ← V2 stub
        └─ DigitalMatrixStrategy    ← V2 stub
```

Each strategy implements:
```ts
interface AnimationStrategy {
  id: AnimationType;
  build(ctx: BuildCtx): void;       // create/update fabric objects for active line
  update(ctx: UpdateCtx): void;     // per-frame visual state from currentTime
  dispose(): void;
}
```

The renderer owns the fabric canvas + active-line lifecycle and delegates per-line build/update to the active strategy. Switching animation type triggers `dispose()` on the old strategy and `build()` on the new one.

## Type system additions (`src/subtitle/types.ts`)

```ts
type AnimationType =
  | 'colorFill' | 'typewriter' | 'rollUp' | 'paintOn'
  | 'popOn' | 'wipe' | 'flapBoard' | 'ticker' | 'digitalMatrix';

type ColorFillOptions      = { transition: 'hardCut' | 'gradient' };
type TypewriterOptions     = { cps: number; variableSpeed: boolean; cursor: '_' | '|' | '.'; blinkRate: number };
type RollUpOptions         = { lineLimit: number; transition: 'hardCut' | 'soft'; lineSpacing: number };
type PaintOnOptions        = { pacing: number; direction: 'ltr' | 'rtl' };

type AnimationConfig =
  | { type: 'colorFill'; options: ColorFillOptions }
  | { type: 'typewriter'; options: TypewriterOptions }
  | { type: 'rollUp'; options: RollUpOptions }
  | { type: 'paintOn'; options: PaintOnOptions }
  | { type: 'popOn' | 'wipe' | 'flapBoard' | 'ticker' | 'digitalMatrix'; options: Record<string, never> };

// Extend SubtitleStyle with fontWeight (already has fontFamily/fontSize/colors)
type SubtitleStyle = { ...; fontWeight: 400 | 600 | 700 | 900 };
```

## Files

**New:**
- `src/subtitle/animations/types.ts` — strategy interface, `BuildCtx`, `UpdateCtx`
- `src/subtitle/animations/registry.ts` — `getStrategy(type)` factory
- `src/subtitle/animations/ColorFillStrategy.ts` — port current behavior + gradient transition
- `src/subtitle/animations/TypewriterStrategy.ts` — char-by-char reveal, blinking cursor, variable speed
- `src/subtitle/animations/RollUpStrategy.ts` — multi-line buffer, hard/soft scroll
- `src/subtitle/animations/PaintOnStrategy.ts` — left-to-right (or RTL) char reveal synced to word timing
- `src/subtitle/animations/stubs.ts` — V2 placeholders (build = no-op, update = render plain text)
- `src/subtitle/AnimationPanel.tsx` — UI to pick animation + per-type options

**Modified:**
- `src/subtitle/types.ts` — add `AnimationType`, `AnimationConfig`, `fontWeight` on style
- `src/subtitle/renderer.ts` — slim down to orchestrator; delegate to active strategy; expose `setAnimation(config)`
- `src/subtitle/sampleData.ts` — add `defaultAnimation: AnimationConfig`
- `src/subtitle/StylePanel.tsx` — add font family + weight selectors (drop current per-anim controls)
- `src/subtitle/SubtitleEditor.tsx` — wire `animation` state, propagate to renderer, render new `<AnimationPanel />`

## UI

Right sidebar gets a new **Animation** section above the existing Style section:
- Animation type select (9 options; V2 ones flagged "Coming soon" but selectable for preview)
- Conditional sub-controls per type (matching the spec: gradient toggle, CPS slider, cursor char, blink rate, line limit, line spacing, pacing, direction, etc.)

## Determinism / export-readiness

Every strategy's `update(currentTime, ...)` must be a pure function of `(time, line, style, options)` — no internal mutable timers, no `setInterval`. Cursor blink uses `Math.floor(currentTime * blinkRate * 2) % 2`. Roll-up scroll offset is computed from elapsed time since the new line entered. Typewriter char count = `floor((time - line.start) * cps)`. This keeps the same renderer usable headlessly for server export later.

## Out of scope

- V2 animations get stub strategies that render the line as plain static text (so the UI option is selectable without crashing) — full implementations come later.
- No font loading UI yet; font family is a text input with a few curated presets.
- No backend / export pipeline changes.
