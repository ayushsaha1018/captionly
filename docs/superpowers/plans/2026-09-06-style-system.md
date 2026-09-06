# SP4 — Style System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework `StylePanel`/`AnimationPanel` onto shadcn components, add built-in style
presets, and expand the style surface (text gradients, a richer active-word glow, a fuller
outline/glow/shadow control set) — with per-field undo coalescing and honest client-export
gating.

**Architecture:** Three new pure functions in `packages/engine/src/utils/textStyle.ts`
(`resolveWordFillCss`, `resolveWordShadowCss`, `resolveWordStrokeCss`) become the single
place that computes a word's fill/shadow/stroke CSS, replacing duplicated (and
inconsistent) inline logic across 8 of the 9 animation components — `DigitalMatrixAnimation`
keeps its bespoke glow (its distinctive signature look) and only adopts the shared stroke
helper. `StylePanel`/`AnimationPanel` move from raw HTML controls and a "whole object"
`onChange` to shadcn components and a per-field `onChange` contract, so `WorkSurface` can
key undo coalescing per field instead of per surface. A new `PRESETS` registry
(engine) and `PresetPicker` (studio) apply a full style+animation bundle in one commit. A
new `exportCapability.ts` (studio) makes the pre-existing client-export/animation mismatch
(discovered while reading `subtitleDrawer.ts`) visible instead of silent.

**Tech Stack:** React 19, Zustand, TypeScript, Bun test runner (`bun:test`), Tailwind,
shadcn/ui (Radix primitives already installed), Remotion.

**Spec:** `docs/superpowers/specs/2026-09-06-style-system-design.md` — read it alongside
this plan; task descriptions below assume its sections as ground truth and don't repeat the
rationale already recorded there.

## Global Constraints

- New `SubtitleStyle` fields are **non-optional** (matches the type's existing flat,
  fully-populated shape). `packages/engine/src/sampleData.ts`'s `defaultStyle` is the
  **only** place in the repo that constructs a full `SubtitleStyle` literal (verified via
  repo-wide grep) — no other file needs updating for the type change.
- `resolveWordFillCss`/`resolveWordShadowCss`/`resolveWordStrokeCss`
  (`packages/engine/src/utils/textStyle.ts`) are the only place word-level fill/shadow/stroke
  CSS is computed. Every animation component calls them **except** `DigitalMatrixAnimation`,
  which keeps its own fill/shadow and only adopts the shared stroke helper.
- The boolean each component passes to `resolveWordFillCss`/`resolveWordShadowCss` is called
  `emphasize` — "render in the active/highlighted state." It is **not always** the same as a
  word's own `isActive`; follow each task's exact mapping (e.g. `ColorFillAnimation` treats
  already-spoken words as fill-emphasized but not shadow-emphasized — only the current word
  glows). Don't generalize across components.
- New fields reproduce today's rendering exactly when untouched, with two deliberate,
  disclosed exceptions: (1) shadow *color* is unified to one rule across every component
  (previously inconsistent — some varied by active state, some didn't); (2) `RollUpAnimation`,
  `PaintOnAnimation`, `FlapBoardAnimation`, `TickerAnimation` gain a shadow for the first time
  (they silently ignored the pre-existing `shadowBlur` control) — an intentional fix, not a
  regression.
- Coalesce keys: style field changes use `` `style:${key}` ``; animation option field changes
  use `` `animation:${type}:${fieldKey}` ``. Animation *type* switches and preset applies are
  discrete actions and never carry a `coalesceKey`.
- New motion (color-swatch hover, slider-thumb active state, preset-apply pulse) is
  implemented with Tailwind's built-in `motion-reduce:` variant — no new dependency, no
  custom keyframes (the already-installed `tw-animate-css` package's `animate-in`/`fade-in`
  utilities cover the preset-apply pulse).
- Test commands: engine — `cd packages/engine && bun test`; studio —
  `cd apps/studio && bun test` and `cd apps/studio && bun run lint`.

---

## Task 1: `SubtitleStyle` type changes + defaults

**Files:**
- Modify: `packages/engine/src/types.ts:17-36` (the `SubtitleStyle` type)
- Modify: `packages/engine/src/sampleData.ts:54-71` (`defaultStyle`)
- Create: `packages/engine/src/sampleData.test.ts`

**Interfaces:**
- Produces: 7 new `SubtitleStyle` fields — `shadowColor: string`, `shadowOffsetX: number`,
  `shadowOffsetY: number`, `textGradientEnabled: boolean`, `textGradientTo: string`,
  `textGradientAngle: number`, `activeGlowMultiplier: number` — and a fully-populated
  `defaultStyle`. Every later task relies on these existing.

- [ ] **Step 1: Write the failing test**

Create `packages/engine/src/sampleData.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { defaultStyle } from "./sampleData";

describe("defaultStyle", () => {
  it("ships the SP4 style-surface defaults, reproducing today's rendering when unused", () => {
    expect(defaultStyle.shadowColor).toBe("#000000");
    expect(defaultStyle.shadowOffsetX).toBe(0);
    expect(defaultStyle.shadowOffsetY).toBe(0);
    expect(defaultStyle.textGradientEnabled).toBe(false);
    expect(defaultStyle.textGradientTo).toBe("#FFD60A");
    expect(defaultStyle.textGradientAngle).toBe(90);
    expect(defaultStyle.activeGlowMultiplier).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/engine && bun test sampleData.test.ts`
Expected: FAIL — `defaultStyle.shadowColor` etc. are `undefined`.

- [ ] **Step 3: Add the fields to the type**

In `packages/engine/src/types.ts`, replace:

```ts
  shadowBlur: number;
  // Layout
```

with:

```ts
  shadowBlur: number;
  shadowColor: string; // hex, base (non-active) shadow/glow color
  shadowOffsetX: number; // px
  shadowOffsetY: number; // px
  // Text-fill gradient (opt-in). Gradient runs from `color` to `textGradientTo`;
  // the active word always stays a flat `activeColor`, never gradient.
  textGradientEnabled: boolean;
  textGradientTo: string; // hex
  textGradientAngle: number; // degrees, CSS linear-gradient angle
  // Multiplies shadowBlur only while a word is in its active/highlighted state.
  activeGlowMultiplier: number;
  // Layout
```

- [ ] **Step 4: Add the defaults**

In `packages/engine/src/sampleData.ts`, replace:

```ts
  shadowBlur: 24,
  boxWidth: 1400,
```

with:

```ts
  shadowBlur: 24,
  shadowColor: "#000000",
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  textGradientEnabled: false,
  textGradientTo: "#FFD60A", // matches activeColor above — a visible two-tone default the moment it's enabled
  textGradientAngle: 90,
  activeGlowMultiplier: 1,
  boxWidth: 1400,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/engine && bun test`
Expected: PASS (20 tests — 19 existing + 1 new)

Also run: `cd apps/studio && bun test`
Expected: PASS (52 tests, unaffected — `historySlice.test.ts` imports `defaultStyle` rather
than constructing a literal, so it picks up the new fields automatically)

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/types.ts packages/engine/src/sampleData.ts packages/engine/src/sampleData.test.ts
git commit -m "feat(engine): add gradient, glow, and shadow-offset fields to SubtitleStyle"
```

---

## Task 2: Scale shadow offsets in `SubtitleOverlay`

**Files:**
- Modify: `packages/engine/src/compositions/SubtitleOverlay.tsx:47-52`

**Interfaces:**
- Consumes: `SubtitleStyle.shadowOffsetX`/`shadowOffsetY` (Task 1).

`shadowBlur` and `strokeWidth` are already scaled here for the composition's actual render
size vs. the 1920×1080 reference; the new offset fields need the same treatment, or a glow
positioned via offset would drift at non-reference resolutions.

- [ ] **Step 1: Add the two scaled fields**

Replace:

```ts
  const scaledStyle = {
    ...style,
    fontSize: scaledFontSize,
    strokeWidth: Math.round((style.strokeWidth ?? 0) * scale),
    shadowBlur: Math.round((style.shadowBlur ?? 0) * scale),
  };
```

with:

```ts
  const scaledStyle = {
    ...style,
    fontSize: scaledFontSize,
    strokeWidth: Math.round((style.strokeWidth ?? 0) * scale),
    shadowBlur: Math.round((style.shadowBlur ?? 0) * scale),
    shadowOffsetX: Math.round(style.shadowOffsetX * scale),
    shadowOffsetY: Math.round(style.shadowOffsetY * scale),
  };
```

- [ ] **Step 2: Run tests**

Run: `cd packages/engine && bun test`
Expected: PASS — no test covers `SubtitleOverlay` directly (it's a Remotion composition, not
a pure function); this is a compile-and-manual-verify change, confirmed visually in Task 8's
browser check once the offset sliders exist.

- [ ] **Step 3: Commit**

```bash
git add packages/engine/src/compositions/SubtitleOverlay.tsx
git commit -m "fix(engine): scale shadow offset fields with composition size"
```

---

## Task 3: Shared word-CSS helpers

**Files:**
- Create: `packages/engine/src/utils/textStyle.ts`
- Create: `packages/engine/src/utils/textStyle.test.ts`

**Interfaces:**
- Produces:
  - `resolveWordStrokeCss(style: SubtitleStyle): React.CSSProperties`
  - `resolveWordFillCss(style: SubtitleStyle, emphasize: boolean): React.CSSProperties`
  - `resolveWordShadowCss(style: SubtitleStyle, emphasize: boolean): React.CSSProperties`

  All three are consumed by Tasks 4 and 5.

- [ ] **Step 1: Write the failing tests**

Create `packages/engine/src/utils/textStyle.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { defaultStyle } from "../sampleData";
import { resolveWordFillCss, resolveWordShadowCss, resolveWordStrokeCss } from "./textStyle";

describe("resolveWordStrokeCss", () => {
  it("returns nothing when strokeWidth is 0", () => {
    expect(resolveWordStrokeCss({ ...defaultStyle, strokeWidth: 0 })).toEqual({});
  });

  it("returns a webkit text stroke and paint order otherwise", () => {
    const css = resolveWordStrokeCss({ ...defaultStyle, strokeWidth: 6, stroke: "#111111" });
    expect(css.WebkitTextStroke).toBe("6px #111111");
    expect(css.paintOrder).toBe("stroke fill");
  });
});

describe("resolveWordFillCss", () => {
  it("emphasized words are always the flat active color, gradient or not", () => {
    const style = { ...defaultStyle, textGradientEnabled: true, activeColor: "#FFD60A" };
    expect(resolveWordFillCss(style, true)).toEqual({ color: "#FFD60A" });
  });

  it("non-emphasized words are the flat color when gradient is disabled", () => {
    const style = { ...defaultStyle, textGradientEnabled: false, color: "#ffffff" };
    expect(resolveWordFillCss(style, false)).toEqual({ color: "#ffffff" });
  });

  it("non-emphasized words gradient-fill from color to textGradientTo when enabled", () => {
    const style = {
      ...defaultStyle,
      textGradientEnabled: true,
      color: "#ffffff",
      textGradientTo: "#ff00ff",
      textGradientAngle: 45,
    };
    const css = resolveWordFillCss(style, false);
    expect(css.backgroundImage).toBe("linear-gradient(45deg, #ffffff, #ff00ff)");
    expect(css.WebkitBackgroundClip).toBe("text");
    expect(css.backgroundClip).toBe("text");
    expect(css.WebkitTextFillColor).toBe("transparent");
  });
});

describe("resolveWordShadowCss", () => {
  it("returns nothing when shadowBlur is 0", () => {
    expect(resolveWordShadowCss({ ...defaultStyle, shadowBlur: 0 }, false)).toEqual({});
  });

  it("uses shadowColor and unmultiplied blur when not emphasized", () => {
    const style = { ...defaultStyle, shadowBlur: 10, shadowColor: "#000000", shadowOffsetX: 2, shadowOffsetY: 3, activeGlowMultiplier: 2 };
    expect(resolveWordShadowCss(style, false).textShadow).toBe("2px 3px 10px #000000");
  });

  it("uses activeColor and multiplied blur when emphasized", () => {
    const style = { ...defaultStyle, shadowBlur: 10, activeColor: "#FFD60A", shadowOffsetX: 0, shadowOffsetY: 0, activeGlowMultiplier: 2 };
    expect(resolveWordShadowCss(style, true).textShadow).toBe("0px 0px 20px #FFD60A");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/engine && bun test textStyle.test.ts`
Expected: FAIL — `./textStyle` does not exist yet.

- [ ] **Step 3: Implement the helpers**

Create `packages/engine/src/utils/textStyle.ts`:

```ts
import type { CSSProperties } from "react";
import type { SubtitleStyle } from "../types";

/** Stroke (outline) CSS — identical across every animation renderer today. */
export function resolveWordStrokeCss(style: SubtitleStyle): CSSProperties {
  if (style.strokeWidth <= 0) return {};
  return {
    WebkitTextStroke: `${style.strokeWidth}px ${style.stroke}`,
    paintOrder: "stroke fill",
  };
}

/**
 * Fill color CSS: flat color, gradient (when enabled), or the flat active
 * color. `emphasize` means "render in the active/highlighted state" — each
 * animation maps its own isActive/isVisible/isSettled concept onto it. The
 * active color always stays flat; the gradient only affects the
 * non-emphasized state, so the highlight never fights a two-tone fill (and,
 * as a consequence, an animation whose words are always emphasized — e.g.
 * TickerAnimation — never visibly shows the gradient; that's expected).
 */
export function resolveWordFillCss(style: SubtitleStyle, emphasize: boolean): CSSProperties {
  if (emphasize) return { color: style.activeColor };
  if (!style.textGradientEnabled) return { color: style.color };
  return {
    backgroundImage: `linear-gradient(${style.textGradientAngle}deg, ${style.color}, ${style.textGradientTo})`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
  };
}

/**
 * Shadow/glow CSS. Color tints toward `activeColor` while emphasized,
 * `shadowColor` otherwise. Blur is boosted by `activeGlowMultiplier` only
 * while emphasized.
 */
export function resolveWordShadowCss(style: SubtitleStyle, emphasize: boolean): CSSProperties {
  if (style.shadowBlur <= 0) return {};
  const blur = style.shadowBlur * (emphasize ? style.activeGlowMultiplier : 1);
  const color = emphasize ? style.activeColor : style.shadowColor;
  return {
    textShadow: `${style.shadowOffsetX}px ${style.shadowOffsetY}px ${blur}px ${color}`,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/engine && bun test`
Expected: PASS (28 tests — 20 from Task 1 + 8 new)

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/utils/textStyle.ts packages/engine/src/utils/textStyle.test.ts
git commit -m "feat(engine): add shared word fill/shadow/stroke CSS resolvers"
```

---

## Task 4: Wire helpers into ColorFill, PopOn, Typewriter, Wipe

**Files:**
- Modify: `packages/engine/src/animations/ColorFillAnimation.tsx`
- Modify: `packages/engine/src/animations/PopOnAnimation.tsx`
- Modify: `packages/engine/src/animations/TypewriterAnimation.tsx`
- Modify: `packages/engine/src/animations/WipeAnimation.tsx`

**Interfaces:**
- Consumes: `resolveWordFillCss`/`resolveWordShadowCss`/`resolveWordStrokeCss` (Task 3).

These four already had *some* inline stroke/shadow logic to replace. No new tests — these
are React/Remotion components with no existing test coverage pattern (the engine's tests are
for pure functions only); correctness is confirmed by the manual browser check in Task 8.

- [ ] **Step 1: `ColorFillAnimation.tsx`**

Replace the whole file:

```tsx
import React from "react";
import { spring } from "remotion";
import type { SubtitleLine, SubtitleStyle, ColorFillOptions } from "../types";
import { resolveWordFillCss, resolveWordShadowCss, resolveWordStrokeCss } from "../utils/textStyle";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options: ColorFillOptions;
  currentTime: number;
  frame: number;
  fps: number;
}

export const ColorFillAnimation: React.FC<AnimationProps> = ({
  line,
  style,
  currentTime,
  frame,
  fps,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        columnGap: "0.28em",
        rowGap: "0.15em",
        textAlign: "center",
      }}
    >
      {line.words.map((word) => {
        const isActive = currentTime >= word.start && currentTime <= word.end;
        const isPast = currentTime > word.end;

        const wordStartFrame = Math.round(word.start * fps);
        const elapsedFrames = Math.max(0, frame - wordStartFrame);

        let scale = 1;
        if (isActive && style.activeScale > 1) {
          const pop = spring({
            frame: elapsedFrames,
            fps,
            config: { damping: 12, mass: 0.5, stiffness: 140 },
          });
          scale = 1 + (style.activeScale - 1) * pop;
        }

        return (
          <span
            key={word.id}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "center bottom",
              display: "inline-block",
              margin: "0 0.12em",
              transition: "color 0.1s ease",
              ...resolveWordFillCss(style, isActive || isPast),
              ...resolveWordStrokeCss(style),
              ...resolveWordShadowCss(style, isActive),
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
```

Note: past words stay fill-emphasized (they were already spoken, so they keep `activeColor`)
but only the *currently* active word glows — matches today's behavior exactly.

- [ ] **Step 2: `PopOnAnimation.tsx`**

Replace the whole file:

```tsx
import React from "react";
import { spring } from "remotion";
import type { SubtitleLine, SubtitleStyle, PopOnOptions } from "../types";
import { resolveWordFillCss, resolveWordShadowCss, resolveWordStrokeCss } from "../utils/textStyle";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options: PopOnOptions;
  currentTime: number;
  frame: number;
  fps: number;
}

export const PopOnAnimation: React.FC<AnimationProps> = ({
  line,
  style,
  options,
  currentTime,
  frame,
  fps,
}) => {
  const popScale = options.popScale ?? 1.15;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        columnGap: "0.28em",
        rowGap: "0.15em",
        textAlign: "center",
      }}
    >
      {line.words.map((word) => {
        const hasStarted = currentTime >= word.start;
        const isActive = currentTime >= word.start && currentTime <= word.end;

        if (!hasStarted) {
          return (
            <span
              key={word.id}
              style={{
                opacity: 0,
                display: "inline-block",
                margin: "0 0.12em",
              }}
            >
              {word.text}
            </span>
          );
        }

        const wordStartFrame = Math.round(word.start * fps);
        const elapsedFrames = Math.max(0, frame - wordStartFrame);

        const progress = spring({
          frame: elapsedFrames,
          fps,
          config: { damping: 10, mass: 0.4, stiffness: 160 },
        });

        const currentScale = progress * (isActive ? popScale : 1);

        return (
          <span
            key={word.id}
            style={{
              opacity: Math.min(1, progress * 1.5),
              transform: `scale(${currentScale})`,
              transformOrigin: "center center",
              display: "inline-block",
              margin: "0 0.12em",
              ...resolveWordFillCss(style, isActive),
              ...resolveWordStrokeCss(style),
              ...resolveWordShadowCss(style, isActive),
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 3: `TypewriterAnimation.tsx`**

Replace the whole file:

```tsx
import React from "react";
import type { SubtitleLine, SubtitleStyle, TypewriterOptions } from "../types";
import { resolveWordFillCss, resolveWordShadowCss, resolveWordStrokeCss } from "../utils/textStyle";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options: TypewriterOptions;
  currentTime: number;
  frame: number;
  fps: number;
}

export const TypewriterAnimation: React.FC<AnimationProps> = ({
  line,
  style,
  options,
  currentTime,
  frame,
  fps,
}) => {
  const fullText = line.words.map((w) => w.text).join(" ");
  const duration = Math.max(0.1, line.end - line.start);
  const elapsed = Math.max(0, currentTime - line.start);
  const ratio = Math.min(1, elapsed / duration);

  const charCount = Math.floor(ratio * fullText.length);
  const visibleText = fullText.slice(0, charCount);

  const blinkRate = options.blinkRate || 1.4;
  const cursorBlink = Math.floor((frame / fps) * blinkRate * 2) % 2 === 0;
  const cursorChar = options.cursor || "|";

  return (
    <div
      className="text-center font-mono whitespace-pre-wrap"
      style={{
        ...resolveWordFillCss(style, false),
        ...resolveWordStrokeCss(style),
        ...resolveWordShadowCss(style, false),
      }}
    >
      <span>{visibleText}</span>
      <span
        style={{
          color: style.activeColor,
          opacity: cursorBlink ? 1 : 0,
          marginLeft: "2px",
        }}
      >
        {cursorChar}
      </span>
    </div>
  );
};
```

Note: `resolveWordShadowCss(style, false)` uses `shadowColor` (default `#000000`, fully
opaque) where the original hardcoded `rgba(0,0,0,0.8)` (80% opaque) — a small, accepted
default-look difference, not worth a dedicated opacity field per the spec's shadow-depth
decision.

- [ ] **Step 4: `WipeAnimation.tsx`**

Replace the whole file:

```tsx
import React from "react";
import type { SubtitleLine, SubtitleStyle, WipeOptions } from "../types";
import { resolveWordFillCss, resolveWordShadowCss, resolveWordStrokeCss } from "../utils/textStyle";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options: WipeOptions;
  currentTime: number;
  frame: number;
  fps: number;
}

export const WipeAnimation: React.FC<AnimationProps> = ({
  line,
  style,
  options,
  currentTime,
}) => {
  const duration = Math.max(0.1, line.end - line.start);
  const progress = Math.max(0, Math.min(1, (currentTime - line.start) / duration));
  const percent = progress * 100;

  const direction = options.direction || "ltr";
  let clipPath = "none";

  switch (direction) {
    case "ltr":
      clipPath = `inset(0 ${100 - percent}% 0 0)`;
      break;
    case "rtl":
      clipPath = `inset(0 0 0 ${100 - percent}%)`;
      break;
    case "ttb":
      clipPath = `inset(0 0 ${100 - percent}% 0)`;
      break;
    case "btt":
      clipPath = `inset(${100 - percent}% 0 0 0)`;
      break;
  }

  const text = line.words.map((w) => w.text).join(" ");

  return (
    <div className="relative text-center whitespace-pre-wrap">
      {/* Background Dim Layer */}
      <span
        style={{
          opacity: 0.3,
          ...resolveWordFillCss(style, false),
          ...resolveWordStrokeCss(style),
        }}
      >
        {text}
      </span>

      {/* Wiped Highlight Layer */}
      <span
        className="absolute inset-0"
        style={{
          clipPath,
          ...resolveWordFillCss(style, true),
          ...resolveWordStrokeCss(style),
          ...resolveWordShadowCss(style, true),
        }}
      >
        {text}
      </span>
    </div>
  );
};
```

- [ ] **Step 5: Run tests**

Run: `cd packages/engine && bun test`
Expected: PASS (28 tests, unaffected — no test targets these components directly)

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/animations/ColorFillAnimation.tsx packages/engine/src/animations/PopOnAnimation.tsx packages/engine/src/animations/TypewriterAnimation.tsx packages/engine/src/animations/WipeAnimation.tsx
git commit -m "refactor(engine): wire shared word-CSS helpers into ColorFill/PopOn/Typewriter/Wipe"
```

---

## Task 5: Wire helpers into RollUp, PaintOn, FlapBoard, Ticker, DigitalMatrix

**Files:**
- Modify: `packages/engine/src/animations/RollUpAnimation.tsx`
- Modify: `packages/engine/src/animations/PaintOnAnimation.tsx`
- Modify: `packages/engine/src/animations/FlapBoardAnimation.tsx`
- Modify: `packages/engine/src/animations/TickerAnimation.tsx`
- Modify: `packages/engine/src/animations/DigitalMatrixAnimation.tsx`

**Interfaces:**
- Consumes: `resolveWordFillCss`/`resolveWordShadowCss`/`resolveWordStrokeCss` (Task 3).

The first four had **no** shadow at all today (the `shadowBlur` control silently did
nothing for them) — this task gives them one, per the Global Constraints note.
`DigitalMatrixAnimation` keeps its bespoke fill/shadow (its distinctive glitch/glow look)
and only adopts the shared stroke helper.

- [ ] **Step 1: `RollUpAnimation.tsx`**

Replace the whole file:

```tsx
import React from "react";
import type { SubtitleLine, SubtitleStyle, RollUpOptions } from "../types";
import { resolveWordFillCss, resolveWordShadowCss, resolveWordStrokeCss } from "../utils/textStyle";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options: RollUpOptions;
  currentTime: number;
  frame: number;
  fps: number;
}

export const RollUpAnimation: React.FC<AnimationProps> = ({
  line,
  style,
  currentTime,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        columnGap: "0.28em",
        rowGap: "0.15em",
        textAlign: "center",
        lineHeight: 1.25,
      }}
    >
      {line.words.map((word) => {
        const isActive = currentTime >= word.start && currentTime <= word.end;

        return (
          <span
            key={word.id}
            style={{
              display: "inline-block",
              margin: "0 0.12em",
              transition: "all 0.15s ease-out",
              ...resolveWordFillCss(style, isActive),
              ...resolveWordStrokeCss(style),
              ...resolveWordShadowCss(style, isActive),
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 2: `PaintOnAnimation.tsx`**

Replace the whole file:

```tsx
import React from "react";
import type { SubtitleLine, SubtitleStyle, PaintOnOptions } from "../types";
import { resolveWordFillCss, resolveWordShadowCss, resolveWordStrokeCss } from "../utils/textStyle";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options: PaintOnOptions;
  currentTime: number;
  frame: number;
  fps: number;
}

export const PaintOnAnimation: React.FC<AnimationProps> = ({
  line,
  style,
  currentTime,
}) => {
  const duration = Math.max(0.1, line.end - line.start);
  const progress = Math.max(0, Math.min(1, (currentTime - line.start) / duration));
  const fullText = line.words.map((w) => w.text).join(" ");
  const charsRevealed = Math.floor(progress * fullText.length);

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
      {fullText.split("").map((char, index) => {
        const isVisible = index <= charsRevealed;
        return (
          <span
            key={index}
            style={{
              opacity: isVisible ? 1 : 0.2,
              filter: isVisible ? "none" : "blur(4px)",
              transition: "filter 0.1s ease, opacity 0.1s ease",
              ...resolveWordFillCss(style, isVisible),
              ...resolveWordStrokeCss(style),
              ...resolveWordShadowCss(style, isVisible),
            }}
          >
            {char === " " ? " " : char}
          </span>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 3: `FlapBoardAnimation.tsx`**

Replace the whole file:

```tsx
import React from "react";
import type { SubtitleLine, SubtitleStyle, FlapBoardOptions } from "../types";
import { resolveWordFillCss, resolveWordShadowCss, resolveWordStrokeCss } from "../utils/textStyle";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options: FlapBoardOptions;
  currentTime: number;
  frame: number;
  fps: number;
}

const CHAR_SET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export const FlapBoardAnimation: React.FC<AnimationProps> = ({
  line,
  style,
  currentTime,
  frame,
}) => {
  const fullText = line.words.map((w) => w.text).join(" ").toUpperCase();
  const duration = Math.max(0.1, line.end - line.start);
  const progress = Math.max(0, Math.min(1, (currentTime - line.start) / duration));

  return (
    <div className="flex flex-wrap items-center justify-center gap-1 text-center font-mono">
      {fullText.split("").map((targetChar, index) => {
        if (targetChar === " ") {
          return <span key={index} className="w-4" />;
        }

        const charProgress = Math.max(0, Math.min(1, progress * fullText.length - index));
        const isSettled = charProgress >= 1;

        let displayChar = targetChar;
        if (!isSettled && charProgress > 0) {
          const charIndex = (index + frame) % CHAR_SET.length;
          displayChar = CHAR_SET[charIndex] || targetChar;
        } else if (charProgress === 0) {
          displayChar = "_";
        }

        return (
          <span
            key={index}
            className="inline-flex items-center justify-center rounded px-1"
            style={{
              backgroundColor: isSettled ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.4)",
              minWidth: "1.1em",
              ...resolveWordFillCss(style, isSettled),
              ...resolveWordStrokeCss(style),
              ...resolveWordShadowCss(style, isSettled),
            }}
          >
            {displayChar}
          </span>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 4: `TickerAnimation.tsx`**

Replace the whole file:

```tsx
import React from "react";
import type { SubtitleLine, SubtitleStyle, TickerOptions } from "../types";
import { resolveWordFillCss, resolveWordShadowCss, resolveWordStrokeCss } from "../utils/textStyle";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options: TickerOptions;
  currentTime: number;
}

export const TickerAnimation: React.FC<AnimationProps> = ({
  line,
  style,
  options,
  currentTime,
}) => {
  const speed = options.speed || 220;
  const offset = -((currentTime * speed) % 1000);
  const text = line.words.map((w) => w.text).join(" ");

  return (
    <div className="overflow-hidden w-full whitespace-nowrap">
      <div
        className="inline-block"
        style={{
          transform: `translateX(${offset}px)`,
          ...resolveWordFillCss(style, true),
          ...resolveWordStrokeCss(style),
          ...resolveWordShadowCss(style, true),
        }}
      >
        <span className="mr-12">{text}</span>
        <span className="mr-12">{text}</span>
        <span className="mr-12">{text}</span>
      </div>
    </div>
  );
};
```

Note: the marquee is always fill-emphasized (it was already always `activeColor`), so per
`resolveWordFillCss`'s rule, gradient never shows on Ticker — an accepted limitation, not a
bug.

- [ ] **Step 5: `DigitalMatrixAnimation.tsx`**

Replace the whole file:

```tsx
import React from "react";
import type { SubtitleLine, SubtitleStyle, DigitalMatrixOptions } from "../types";
import { resolveWordStrokeCss } from "../utils/textStyle";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options: DigitalMatrixOptions;
  currentTime: number;
  frame: number;
}

export const DigitalMatrixAnimation: React.FC<AnimationProps> = ({
  line,
  style,
  options,
  currentTime,
  frame,
}) => {
  const glitchAmp = options.glitchAmplitude ?? 3;
  const glow = options.glowIntensity ?? 0.8;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        columnGap: "0.28em",
        rowGap: "0.15em",
        textAlign: "center",
        fontFamily: "monospace",
      }}
    >
      {line.words.map((word) => {
        const isActive = currentTime >= word.start && currentTime <= word.end;

        const glitchX = isActive ? (Math.sin(frame * 1.5) * glitchAmp).toFixed(1) : 0;
        const glitchY = isActive ? (Math.cos(frame * 2) * (glitchAmp / 2)).toFixed(1) : 0;

        return (
          <span
            key={word.id}
            style={{
              color: isActive ? style.activeColor : style.color,
              transform: `translate(${glitchX}px, ${glitchY}px)`,
              textShadow: isActive
                ? `0 0 ${12 * glow}px ${style.activeColor}, 0 0 ${24 * glow}px #00ff66`
                : "none",
              display: "inline-block",
              margin: "0 0.12em",
              ...resolveWordStrokeCss(style),
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 6: Run tests**

Run: `cd packages/engine && bun test`
Expected: PASS (28 tests, unaffected)

- [ ] **Step 7: Commit**

```bash
git add packages/engine/src/animations/RollUpAnimation.tsx packages/engine/src/animations/PaintOnAnimation.tsx packages/engine/src/animations/FlapBoardAnimation.tsx packages/engine/src/animations/TickerAnimation.tsx packages/engine/src/animations/DigitalMatrixAnimation.tsx
git commit -m "refactor(engine): wire shared word-CSS helpers into remaining animations"
```

---

## Task 6: Presets registry

**Files:**
- Create: `packages/engine/src/presets.ts`
- Create: `packages/engine/src/presets.test.ts`
- Modify: `packages/engine/src/index.ts` (add one export line)

**Interfaces:**
- Produces: `StylePreset = { label: string; style: SubtitleStyle; animation: AnimationConfig }`
  and `PRESETS: Record<string, StylePreset>`, exported from `@captionly/engine`. Consumed by
  Task 11 (`PresetPicker`).

- [ ] **Step 1: Write the failing test**

Create `packages/engine/src/presets.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { PRESETS } from "./presets";

const STYLE_KEYS = [
  "fontFamily", "fontWeight", "fontSize", "color", "activeColor", "stroke", "strokeWidth",
  "activeScale", "shadowBlur", "shadowColor", "shadowOffsetX", "shadowOffsetY",
  "textGradientEnabled", "textGradientTo", "textGradientAngle", "activeGlowMultiplier",
  "boxWidth", "boxAnchor", "bgColor", "bgOpacity", "bgRadius", "bgPaddingX", "bgPaddingY",
] as const;

describe("PRESETS", () => {
  it("has at least one preset", () => {
    expect(Object.keys(PRESETS).length).toBeGreaterThan(0);
  });

  for (const [key, preset] of Object.entries(PRESETS)) {
    it(`${key} has a label and every SubtitleStyle key`, () => {
      expect(preset.label.length).toBeGreaterThan(0);
      for (const styleKey of STYLE_KEYS) {
        expect(preset.style[styleKey]).not.toBeUndefined();
      }
      expect(preset.animation.type).toBeDefined();
      expect(preset.animation.options).toBeDefined();
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/engine && bun test presets.test.ts`
Expected: FAIL — `./presets` does not exist yet.

- [ ] **Step 3: Implement the registry**

Create `packages/engine/src/presets.ts`:

```ts
import type { SubtitleStyle, AnimationConfig } from "./types";
import { defaultStyle } from "./sampleData";

export type StylePreset = {
  label: string;
  style: SubtitleStyle;
  animation: AnimationConfig;
};

export const PRESETS: Record<string, StylePreset> = {
  boldKaraoke: {
    label: "Bold Karaoke",
    style: {
      ...defaultStyle,
      fontWeight: 900,
      activeColor: "#FFD60A",
      activeScale: 1.3,
      strokeWidth: 8,
      shadowBlur: 20,
      activeGlowMultiplier: 1.6,
    },
    animation: { type: "colorFill", options: { transition: "hardCut" } },
  },
  cleanMinimal: {
    label: "Clean Minimal",
    style: {
      ...defaultStyle,
      fontWeight: 600,
      strokeWidth: 0,
      shadowBlur: 8,
      bgOpacity: 0.55,
      bgRadius: 12,
      activeScale: 1,
    },
    animation: { type: "paintOn", options: { direction: "ltr", maxCps: 35 } },
  },
  neonGlow: {
    label: "Neon Glow",
    style: {
      ...defaultStyle,
      color: "#e0f7ff",
      activeColor: "#00e5ff",
      shadowColor: "#00e5ff",
      shadowBlur: 36,
      activeGlowMultiplier: 2,
      textGradientEnabled: true,
      textGradientTo: "#ff2ec4",
      textGradientAngle: 90,
      strokeWidth: 0,
    },
    animation: { type: "wipe", options: { direction: "ltr" } },
  },
  typewriterMono: {
    label: "Typewriter",
    style: {
      ...defaultStyle,
      fontFamily: "'Courier New', monospace",
      fontWeight: 700,
      shadowBlur: 0,
    },
    animation: { type: "typewriter", options: { cursor: "|", blinkRate: 1.4, maxCps: 35 } },
  },
  breakingNews: {
    label: "Breaking News",
    style: {
      ...defaultStyle,
      color: "#ffffff",
      activeColor: "#ff3b30",
      bgColor: "#ff3b30",
      bgOpacity: 1,
      bgRadius: 0,
      fontWeight: 900,
    },
    animation: { type: "ticker", options: { speed: 260, gap: 200 } },
  },
  digitalMatrix: {
    label: "Digital Matrix",
    style: {
      ...defaultStyle,
      fontFamily: "'Courier New', monospace",
      color: "#0f0",
      activeColor: "#00ff66",
    },
    animation: { type: "digitalMatrix", options: { glitchAmplitude: 4, glowIntensity: 0.9 } },
  },
};
```

- [ ] **Step 4: Export it**

In `packages/engine/src/index.ts`, add (near the other `export *` lines, after
`export * from "./sampleData";`):

```ts
export * from "./presets";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/engine && bun test`
Expected: PASS (35 tests — 28 from Task 5 + 1 "has at least one preset" + 6 per-preset)

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/presets.ts packages/engine/src/presets.test.ts packages/engine/src/index.ts
git commit -m "feat(engine): add built-in style presets"
```

---

## Task 7: Client-export capability gating

**Files:**
- Create: `apps/studio/src/export/exportCapability.ts`
- Create: `apps/studio/src/export/exportCapability.test.ts`

**Interfaces:**
- Produces: `isClientExportSupported(style: SubtitleStyle, animation: AnimationConfig):
  { supported: boolean; reason?: string }`. Consumed by Task 12 (`ExportDialog`).

- [ ] **Step 1: Write the failing tests**

Create `apps/studio/src/export/exportCapability.test.ts`:

```ts
import { test, expect } from "bun:test";
import { defaultStyle, defaultAnimation } from "@captionly/engine";
import { isClientExportSupported } from "./exportCapability";

test("hardCut colorFill with no gradient is supported", () => {
  expect(isClientExportSupported(defaultStyle, defaultAnimation).supported).toBe(true);
});

test("any non-colorFill animation is unsupported", () => {
  const result = isClientExportSupported(defaultStyle, {
    type: "typewriter",
    options: { cursor: "|", blinkRate: 1.4, maxCps: 35 },
  });
  expect(result.supported).toBe(false);
  expect(result.reason).toBeDefined();
});

test("colorFill with a gradient transition is unsupported", () => {
  const result = isClientExportSupported(defaultStyle, {
    type: "colorFill",
    options: { transition: "gradient" },
  });
  expect(result.supported).toBe(false);
});

test("enabled text gradient is unsupported even with colorFill hardCut", () => {
  const style = { ...defaultStyle, textGradientEnabled: true };
  expect(isClientExportSupported(style, defaultAnimation).supported).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/studio && bun test exportCapability.test.ts`
Expected: FAIL — `./exportCapability` does not exist yet.

- [ ] **Step 3: Implement the check**

Create `apps/studio/src/export/exportCapability.ts`:

```ts
import type { SubtitleStyle, AnimationConfig } from "@captionly/engine";

export interface ExportCapability {
  supported: boolean;
  reason?: string;
}

/**
 * subtitleDrawer.ts (the client WebCodecs canvas renderer) hardcodes one
 * look — word-by-word reveal by time, flat fill, single shadow color — and
 * never reads `animation.type`. This is the only style/animation
 * combination it actually reproduces correctly; everything else silently
 * mis-renders.
 */
export function isClientExportSupported(
  style: SubtitleStyle,
  animation: AnimationConfig,
): ExportCapability {
  if (animation.type !== "colorFill" || animation.options.transition !== "hardCut") {
    return {
      supported: false,
      reason:
        "The client export renders a fixed word-reveal look and ignores the selected animation. Use server export for an accurate result.",
    };
  }
  if (style.textGradientEnabled) {
    return {
      supported: false,
      reason: "The client export can't draw gradient text yet. Use server export for an accurate result.",
    };
  }
  return { supported: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/studio && bun test`
Expected: PASS (56 tests — 52 existing + 4 new)

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/export/exportCapability.ts apps/studio/src/export/exportCapability.test.ts
git commit -m "feat(studio): add client-export capability check"
```

---

## Task 8: `StylePanel` — shadcn rework + new fields + exposed stroke color

**Files:**
- Modify: `apps/studio/src/subtitle/StylePanel.tsx` (full rewrite)

**Interfaces:**
- Consumes: `SubtitleStyle` (Task 1).
- Produces: `onFieldChange: <K extends keyof SubtitleStyle>(key: K, value: SubtitleStyle[K])
  => void` replaces the old `onStyleChange: (s: SubtitleStyle) => void` prop — Task 10
  (`WorkSurface`) must update to match.

- [ ] **Step 1: Replace the whole file**

```tsx
import type { SubtitleStyle, SafeZonePreset } from "@captionly/engine";
import { SAFE_ZONES } from "./SafeZones";
import { useStudioStore } from "@/store";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type Props = {
  style: SubtitleStyle;
  onFieldChange: <K extends keyof SubtitleStyle>(key: K, value: SubtitleStyle[K]) => void;
  safeZone: SafeZonePreset;
  onSafeZoneChange: (z: SafeZonePreset) => void;
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-2">
    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {label}
    </label>
    {children}
  </div>
);

const FONTS = [
  "Inter, system-ui, sans-serif",
  "Georgia, serif",
  "'Courier New', monospace",
  "Impact, sans-serif",
  "'Arial Black', sans-serif",
];

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Row label={label}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className="h-10 w-full rounded-md border border-border shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:scale-100"
            style={{ backgroundColor: value }}
          />
        </PopoverTrigger>
        <PopoverContent className="w-48 space-y-2">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-full cursor-pointer rounded-md border border-border bg-transparent"
          />
          <Input value={value} onChange={(e) => onChange(e.target.value)} className="text-xs" />
        </PopoverContent>
      </Popover>
    </Row>
  );
}

export function StylePanel({ style, onFieldChange, safeZone, onSafeZoneChange }: Props) {
  const video = useStudioStore((s) => s.video);
  const targetCategory = video && video.width < video.height ? "9:16" : "16:9";

  const recommendedEntries = Object.entries(SAFE_ZONES).filter(
    ([, m]) => m.category === targetCategory,
  );
  const otherEntries = Object.entries(SAFE_ZONES).filter(([, m]) => m.category !== targetCategory);

  const set = <K extends keyof SubtitleStyle>(k: K, v: SubtitleStyle[K]) => onFieldChange(k, v);

  return (
    <aside className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 shadow-lg h-fit">
      <div>
        <h2 className="text-sm font-semibold text-card-foreground">Subtitle Style</h2>
        <p className="text-xs text-ink-muted mt-1">Applies to every line in the project.</p>
      </div>

      <Row label="Font family">
        <Select value={style.fontFamily} onValueChange={(v) => set("fontFamily", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONTS.map((f) => (
              <SelectItem key={f} value={f}>
                {f.split(",")[0].replace(/'/g, "")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      <div className="grid grid-cols-2 gap-3">
        <Row label="Weight">
          <Select
            value={String(style.fontWeight)}
            onValueChange={(v) => set("fontWeight", +v as SubtitleStyle["fontWeight"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="400">Regular</SelectItem>
              <SelectItem value="600">Semibold</SelectItem>
              <SelectItem value="700">Bold</SelectItem>
              <SelectItem value="900">Black</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row label={`Size (${style.fontSize}px)`}>
          <Slider
            value={[style.fontSize]}
            min={32}
            max={160}
            step={2}
            onValueChange={([v]) => set("fontSize", v)}
          />
        </Row>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ColorField label="Inactive color" value={style.color} onChange={(v) => set("color", v)} />
        <ColorField
          label="Active color"
          value={style.activeColor}
          onChange={(v) => set("activeColor", v)}
        />
      </div>

      <div className="border-t border-border pt-4 grid grid-cols-2 gap-3">
        <ColorField label="Stroke color" value={style.stroke} onChange={(v) => set("stroke", v)} />
        <Row label={`Stroke width (${style.strokeWidth}px)`}>
          <Slider
            value={[style.strokeWidth]}
            min={0}
            max={20}
            step={1}
            onValueChange={([v]) => set("strokeWidth", v)}
          />
        </Row>
      </div>

      <Row label={`Active scale (${style.activeScale.toFixed(2)}x)`}>
        <Slider
          value={[style.activeScale]}
          min={1}
          max={2}
          step={0.05}
          onValueChange={([v]) => set("activeScale", v)}
        />
      </Row>

      <div className="border-t border-border pt-4 flex flex-col gap-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-card-foreground">
          Shadow &amp; glow
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <ColorField
            label="Shadow color"
            value={style.shadowColor}
            onChange={(v) => set("shadowColor", v)}
          />
          <Row label={`Blur (${style.shadowBlur}px)`}>
            <Slider
              value={[style.shadowBlur]}
              min={0}
              max={64}
              step={2}
              onValueChange={([v]) => set("shadowBlur", v)}
            />
          </Row>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Row label={`Offset X (${style.shadowOffsetX}px)`}>
            <Slider
              value={[style.shadowOffsetX]}
              min={-40}
              max={40}
              step={1}
              onValueChange={([v]) => set("shadowOffsetX", v)}
            />
          </Row>
          <Row label={`Offset Y (${style.shadowOffsetY}px)`}>
            <Slider
              value={[style.shadowOffsetY]}
              min={-40}
              max={40}
              step={1}
              onValueChange={([v]) => set("shadowOffsetY", v)}
            />
          </Row>
        </div>
        <Row label={`Active glow boost (${style.activeGlowMultiplier.toFixed(1)}x)`}>
          <Slider
            value={[style.activeGlowMultiplier]}
            min={1}
            max={4}
            step={0.1}
            onValueChange={([v]) => set("activeGlowMultiplier", v)}
          />
        </Row>
      </div>

      <div className="border-t border-border pt-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-card-foreground">
            Text gradient
          </h3>
          <Switch
            checked={style.textGradientEnabled}
            onCheckedChange={(v) => set("textGradientEnabled", v)}
          />
        </div>
        {style.textGradientEnabled && (
          <div className="grid grid-cols-2 gap-3">
            <ColorField
              label="Gradient to"
              value={style.textGradientTo}
              onChange={(v) => set("textGradientTo", v)}
            />
            <Row label={`Angle (${style.textGradientAngle}°)`}>
              <Slider
                value={[style.textGradientAngle]}
                min={0}
                max={360}
                step={5}
                onValueChange={([v]) => set("textGradientAngle", v)}
              />
            </Row>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4 flex flex-col gap-4">
        <Row label={`Box width (${style.boxWidth}px)`}>
          <Slider
            value={[style.boxWidth]}
            min={300}
            max={1900}
            step={20}
            onValueChange={([v]) => set("boxWidth", v)}
          />
        </Row>
        <Row label="Wrap grows from">
          <Select
            value={style.boxAnchor}
            onValueChange={(v) => set("boxAnchor", v as SubtitleStyle["boxAnchor"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bottom">Bottom (grows upward)</SelectItem>
              <SelectItem value="top">Top (grows downward)</SelectItem>
              <SelectItem value="center">Center (grows both ways)</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      </div>

      <div className="border-t border-border pt-4 flex flex-col gap-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-card-foreground">
          Background
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <ColorField label="Color" value={style.bgColor} onChange={(v) => set("bgColor", v)} />
          <Row label={`Opacity (${style.bgOpacity.toFixed(2)})`}>
            <Slider
              value={[style.bgOpacity]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={([v]) => set("bgOpacity", v)}
            />
          </Row>
        </div>
        <Row label={`Corner radius (${style.bgRadius}px)`}>
          <Slider
            value={[style.bgRadius]}
            min={0}
            max={64}
            step={1}
            onValueChange={([v]) => set("bgRadius", v)}
          />
        </Row>
        <div className="grid grid-cols-2 gap-3">
          <Row label={`Padding X (${style.bgPaddingX}px)`}>
            <Slider
              value={[style.bgPaddingX]}
              min={0}
              max={80}
              step={2}
              onValueChange={([v]) => set("bgPaddingX", v)}
            />
          </Row>
          <Row label={`Padding Y (${style.bgPaddingY}px)`}>
            <Slider
              value={[style.bgPaddingY]}
              min={0}
              max={60}
              step={2}
              onValueChange={([v]) => set("bgPaddingY", v)}
            />
          </Row>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <Row label="Safe zone overlay">
          <Select value={safeZone} onValueChange={(v) => onSafeZoneChange(v as SafeZonePreset)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectGroup>
                <SelectLabel>{`Recommended (${targetCategory})`}</SelectLabel>
                {recommendedEntries.map(([key, meta]) => (
                  <SelectItem key={key} value={key}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Other formats</SelectLabel>
                {otherEntries.map(([key, meta]) => (
                  <SelectItem key={key} value={key}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Row>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Add the drag/hover motion to the shared `Slider` primitive**

`apps/studio/src/components/ui/slider.tsx` is unused elsewhere in the app today (confirmed —
this is its first consumer), so tinting its thumb and adding the drag-state scale bump here
benefits every future user of it too. Replace the `Thumb` line:

```tsx
    <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
```

with:

```tsx
    <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-[transform,colors] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-125 motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50" />
```

(`border-primary` already resolves to the violet edit-affordance token in the dark theme —
no new color introduced, just a drag-state scale.)

- [ ] **Step 3: Run tests**

Run: `cd apps/studio && bun test`
Expected: PASS (56 tests — `StylePanel`/`AnimationPanel` have no direct tests; the contract
change is validated by Task 10 compiling against it)

Run: `cd apps/studio && bun run lint`
Expected: 0 errors

- [ ] **Step 4: Manually verify in the browser**

Run `cd apps/studio && bun run dev` (Node 22.x — see roadmap §6), open the app, load the demo
video, switch to the Style tab. Confirm: every existing control (font, weight, size, colors,
stroke width, active scale, box width/anchor, background, safe zone) still changes the
preview identically to before. Then confirm the **new** controls: stroke color swatch now
visibly tints the outline; shadow color/offset X/Y/blur move the glow; the active-glow-boost
slider only affects the currently-spoken word; the gradient switch reveals "Gradient to" +
angle and the text visibly gradient-fills when enabled (and reverts to flat color when
switched off). Confirm color swatches scale up slightly on hover and slider thumbs bump on
drag; confirm both disappear with OS "reduce motion" enabled.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/subtitle/StylePanel.tsx apps/studio/src/components/ui/slider.tsx
git commit -m "feat(studio): rework StylePanel onto shadcn, add gradient/glow/shadow controls"
```

---

## Task 9: `AnimationPanel` — shadcn rework + per-field contract

**Files:**
- Modify: `apps/studio/src/subtitle/AnimationPanel.tsx` (full rewrite)

**Interfaces:**
- Produces: `onTypeChange: (type: AnimationType) => void` and `onOptionChange: (fieldKey:
  string, options: AnimationConfig["options"]) => void` replace the old single
  `onChange: (a: AnimationConfig) => void` prop. `fieldKey` is a plain string naming which
  option field changed (e.g. `"blinkRate"`) — used only to build the undo coalesce key, the
  merged `options` object is still passed in full (same merge shape as today). Task 10
  (`WorkSurface`) must update to match.

- [ ] **Step 1: Replace the whole file**

```tsx
import {
  ANIMATION_LABELS,
  type AnimationConfig,
  type AnimationType,
  type ColorFillOptions,
  type TypewriterOptions,
  type RollUpOptions,
  type PaintOnOptions,
  type PopOnOptions,
  type WipeOptions,
  type FlapBoardOptions,
  type TickerOptions,
  type DigitalMatrixOptions,
} from "@captionly/engine";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

type Props = {
  animation: AnimationConfig;
  onTypeChange: (type: AnimationType) => void;
  onOptionChange: (fieldKey: string, options: AnimationConfig["options"]) => void;
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-2">
    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {label}
    </label>
    {children}
  </div>
);

const ANIM_TYPES: AnimationType[] = [
  "colorFill",
  "typewriter",
  "rollUp",
  "paintOn",
  "popOn",
  "wipe",
  "flapBoard",
  "ticker",
  "digitalMatrix",
];

export function AnimationPanel({ animation, onTypeChange, onOptionChange }: Props) {
  const setOptions = <T extends AnimationConfig["options"]>(fieldKey: string, opts: T) => {
    onOptionChange(fieldKey, opts);
  };

  return (
    <aside className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 shadow-lg h-fit">
      <div>
        <h2 className="text-sm font-semibold text-card-foreground">Animation</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Pick a caption animation. Speed adapts to each line's start/end time.
        </p>
      </div>

      <Row label="Type">
        <Select value={animation.type} onValueChange={(v) => onTypeChange(v as AnimationType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANIM_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {ANIMATION_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      {animation.type === "colorFill" && (
        <Row label="Transition">
          <Select
            value={animation.options.transition}
            onValueChange={(v) =>
              setOptions<ColorFillOptions>("transition", {
                transition: v as ColorFillOptions["transition"],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hardCut">Hard cut</SelectItem>
              <SelectItem value="gradient">Gradient (left-to-right)</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      )}

      {animation.type === "typewriter" && (
        <>
          <Row label="Cursor">
            <Select
              value={animation.options.cursor}
              onValueChange={(v) =>
                setOptions<TypewriterOptions>("cursor", {
                  ...animation.options,
                  cursor: v as TypewriterOptions["cursor"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="|">Line ( | )</SelectItem>
                <SelectItem value="_">Underscore ( _ )</SelectItem>
                <SelectItem value=".">Dot ( . )</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label={`Blink rate (${animation.options.blinkRate.toFixed(1)} Hz)`}>
            <Slider
              value={[animation.options.blinkRate]}
              min={0}
              max={4}
              step={0.1}
              onValueChange={([v]) =>
                setOptions<TypewriterOptions>("blinkRate", { ...animation.options, blinkRate: v })
              }
            />
          </Row>
          <Row label={`Max speed cap (${animation.options.maxCps} chars/s)`}>
            <Slider
              value={[animation.options.maxCps]}
              min={10}
              max={80}
              step={1}
              onValueChange={([v]) =>
                setOptions<TypewriterOptions>("maxCps", { ...animation.options, maxCps: v })
              }
            />
          </Row>
        </>
      )}

      {animation.type === "rollUp" && (
        <>
          <Row label={`Line limit (${animation.options.lineLimit})`}>
            <Slider
              value={[animation.options.lineLimit]}
              min={1}
              max={5}
              step={1}
              onValueChange={([v]) =>
                setOptions<RollUpOptions>("lineLimit", { ...animation.options, lineLimit: v })
              }
            />
          </Row>
          <Row label="Transition">
            <Select
              value={animation.options.transition}
              onValueChange={(v) =>
                setOptions<RollUpOptions>("transition", {
                  ...animation.options,
                  transition: v as RollUpOptions["transition"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hardCut">Hard cut</SelectItem>
                <SelectItem value="soft">Soft scroll</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label={`Line spacing (${animation.options.lineSpacing}px)`}>
            <Slider
              value={[animation.options.lineSpacing]}
              min={0}
              max={64}
              step={2}
              onValueChange={([v]) =>
                setOptions<RollUpOptions>("lineSpacing", { ...animation.options, lineSpacing: v })
              }
            />
          </Row>
        </>
      )}

      {animation.type === "paintOn" && (
        <>
          <Row label="Direction">
            <Select
              value={animation.options.direction}
              onValueChange={(v) =>
                setOptions<PaintOnOptions>("direction", {
                  ...animation.options,
                  direction: v as PaintOnOptions["direction"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ltr">Left → Right</SelectItem>
                <SelectItem value="rtl">Right → Left (Arabic / Hebrew)</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label={`Max speed cap (${animation.options.maxCps} chars/s)`}>
            <Slider
              value={[animation.options.maxCps]}
              min={10}
              max={80}
              step={1}
              onValueChange={([v]) =>
                setOptions<PaintOnOptions>("maxCps", { ...animation.options, maxCps: v })
              }
            />
          </Row>
        </>
      )}

      {animation.type === "popOn" && (
        <>
          <Row label={`Pop scale (${animation.options.popScale.toFixed(2)}x)`}>
            <Slider
              value={[animation.options.popScale]}
              min={1}
              max={1.6}
              step={0.01}
              onValueChange={([v]) =>
                setOptions<PopOnOptions>("popScale", { ...animation.options, popScale: v })
              }
            />
          </Row>
          <Row label={`Pop duration (${animation.options.popDuration.toFixed(2)}s)`}>
            <Slider
              value={[animation.options.popDuration]}
              min={0.05}
              max={0.8}
              step={0.01}
              onValueChange={([v]) =>
                setOptions<PopOnOptions>("popDuration", { ...animation.options, popDuration: v })
              }
            />
          </Row>
        </>
      )}

      {animation.type === "wipe" && (
        <Row label="Direction">
          <Select
            value={animation.options.direction}
            onValueChange={(v) =>
              setOptions<WipeOptions>("direction", { direction: v as WipeOptions["direction"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ltr">Left → Right</SelectItem>
              <SelectItem value="rtl">Right → Left</SelectItem>
              <SelectItem value="ttb">Top → Bottom</SelectItem>
              <SelectItem value="btt">Bottom → Top</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      )}

      {animation.type === "flapBoard" && (
        <>
          <Row label={`Flap duration (${animation.options.flapDuration.toFixed(2)}s)`}>
            <Slider
              value={[animation.options.flapDuration]}
              min={0.1}
              max={2}
              step={0.05}
              onValueChange={([v]) =>
                setOptions<FlapBoardOptions>("flapDuration", {
                  ...animation.options,
                  flapDuration: v,
                })
              }
            />
          </Row>
          <Row label={`Cycles per char (${animation.options.cyclesPerChar})`}>
            <Slider
              value={[animation.options.cyclesPerChar]}
              min={2}
              max={20}
              step={1}
              onValueChange={([v]) =>
                setOptions<FlapBoardOptions>("cyclesPerChar", {
                  ...animation.options,
                  cyclesPerChar: v,
                })
              }
            />
          </Row>
        </>
      )}

      {animation.type === "ticker" && (
        <>
          <Row label={`Scroll speed (${animation.options.speed} px/s)`}>
            <Slider
              value={[animation.options.speed]}
              min={50}
              max={600}
              step={10}
              onValueChange={([v]) =>
                setOptions<TickerOptions>("speed", { ...animation.options, speed: v })
              }
            />
          </Row>
          <Row label={`Gap (${animation.options.gap}px)`}>
            <Slider
              value={[animation.options.gap]}
              min={0}
              max={400}
              step={10}
              onValueChange={([v]) =>
                setOptions<TickerOptions>("gap", { ...animation.options, gap: v })
              }
            />
          </Row>
        </>
      )}

      {animation.type === "digitalMatrix" && (
        <>
          <Row label={`Glow intensity (${animation.options.glowIntensity.toFixed(2)})`}>
            <Slider
              value={[animation.options.glowIntensity]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={([v]) =>
                setOptions<DigitalMatrixOptions>("glowIntensity", {
                  ...animation.options,
                  glowIntensity: v,
                })
              }
            />
          </Row>
          <Row label={`Glitch jitter (${animation.options.glitchAmplitude}px)`}>
            <Slider
              value={[animation.options.glitchAmplitude]}
              min={0}
              max={12}
              step={1}
              onValueChange={([v]) =>
                setOptions<DigitalMatrixOptions>("glitchAmplitude", {
                  ...animation.options,
                  glitchAmplitude: v,
                })
              }
            />
          </Row>
        </>
      )}
    </aside>
  );
}
```

- [ ] **Step 2: Run tests**

Run: `cd apps/studio && bun test`
Expected: PASS (56 tests, unaffected until Task 10 wires the new contract)

Run: `cd apps/studio && bun run lint`
Expected: 0 errors

- [ ] **Step 3: Manually verify in the browser**

Switch through every animation type in the Type dropdown and confirm each type's option
controls render and still change the preview identically to before the shadcn swap.

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/subtitle/AnimationPanel.tsx
git commit -m "feat(studio): rework AnimationPanel onto shadcn, split type/option change contract"
```

---

## Task 10: `WorkSurface` — per-field coalescing + new panel contracts

**Files:**
- Modify: `apps/studio/src/app/WorkSurface.tsx` (full rewrite)

**Interfaces:**
- Consumes: `StylePanel`'s `onFieldChange` (Task 8), `AnimationPanel`'s `onTypeChange`/
  `onOptionChange` (Task 9).
- Produces: `applyPreset: (preset: StylePreset) => void`, passed to `PresetPicker` (Task 11).

- [ ] **Step 1: Replace the whole file**

```tsx
import type { PlayerRef } from "@remotion/player";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useStudioStore } from "@/store";
import { StylePanel } from "@/subtitle/StylePanel";
import { AnimationPanel } from "@/subtitle/AnimationPanel";
import { PresetPicker } from "@/subtitle/PresetPicker";
import { LineList } from "@/lines/LineList";
import { cn } from "@/lib/utils";
import { defaultOptionsFor, type StylePreset } from "@captionly/engine";
import type { SafeZonePreset, SubtitleStyle, AnimationConfig, AnimationType } from "@captionly/engine";

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
  const commit = useStudioStore((s) => s.commit);
  const lineCount = useStudioStore((s) => s.lines.length);

  const [pulsing, setPulsing] = useState(false);

  // commit() snapshots the CURRENT state, so it must run BEFORE the mutation
  // it is meant to undo. Committing after would record the post-change state
  // and undo would land a step short.
  //
  // Coalesce keys are per-field (`style:${key}`, `animation:${type}:${key}`)
  // so two different sliders touched within the coalesce window don't merge
  // into one undo step.
  const changeStyleField = <K extends keyof SubtitleStyle>(key: K, value: SubtitleStyle[K]) => {
    commit("Change style", { coalesceKey: `style:${String(key)}` });
    setStyle({ [key]: value } as Partial<SubtitleStyle>);
  };

  const changeAnimationType = (type: AnimationType) => {
    commit("Change animation");
    setAnimation({ type, options: defaultOptionsFor(type) } as AnimationConfig);
  };

  const changeAnimationOption = (fieldKey: string, options: AnimationConfig["options"]) => {
    commit("Change animation", { coalesceKey: `animation:${animation.type}:${fieldKey}` });
    setAnimation({ ...animation, options } as AnimationConfig);
  };

  const applyPreset = (preset: StylePreset) => {
    commit("Apply preset");
    setStyle(preset.style);
    setAnimation(preset.animation);
    setPulsing(true);
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setTab(v as "lines" | "style")}
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      {/* Tabs and the line count stay put; only the panel below scrolls. */}
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <TabsList>
          <TabsTrigger value="lines">Lines</TabsTrigger>
          <TabsTrigger value="style">Style</TabsTrigger>
        </TabsList>
        <span className="tabular text-xs text-ink-muted">{lineCount} lines</span>
      </div>

      <TabsContent value="lines" className="min-h-0 flex-1 overflow-y-auto pr-1">
        <LineList playerRef={playerRef} />
      </TabsContent>

      <TabsContent
        value="style"
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1",
          pulsing && "animate-in fade-in duration-150 motion-reduce:animate-none",
        )}
        onAnimationEnd={() => setPulsing(false)}
      >
        <PresetPicker onApply={applyPreset} />
        <AnimationPanel
          animation={animation}
          onTypeChange={changeAnimationType}
          onOptionChange={changeAnimationOption}
        />
        <StylePanel
          style={style}
          onFieldChange={changeStyleField}
          safeZone={safeZone}
          onSafeZoneChange={onSafeZoneChange}
        />
      </TabsContent>
    </Tabs>
  );
}
```

`PresetPicker` doesn't exist yet — this task will not compile/build cleanly until Task 11
adds it. That's expected (Task 11 is next); do not skip Task 11.

- [ ] **Step 2: Run tests**

Run: `cd apps/studio && bun test`
Expected: PASS (56 tests). `bun test` doesn't type-check or bundle, so the missing
`PresetPicker` module doesn't fail it — but proceed straight to Task 11 before attempting a
build.

- [ ] **Step 3: Commit**

```bash
git add apps/studio/src/app/WorkSurface.tsx
git commit -m "refactor(studio): per-field undo coalescing for style/animation changes"
```

---

## Task 11: `PresetPicker`

**Files:**
- Create: `apps/studio/src/subtitle/PresetPicker.tsx`

**Interfaces:**
- Consumes: `PRESETS`, `StylePreset` (Task 6); `applyPreset` from `WorkSurface` (Task 10).

- [ ] **Step 1: Create the component**

Create `apps/studio/src/subtitle/PresetPicker.tsx`:

```tsx
import { PRESETS, type StylePreset } from "@captionly/engine";
import { Button } from "@/components/ui/button";

export function PresetPicker({ onApply }: { onApply: (preset: StylePreset) => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-lg h-fit">
      <h2 className="text-sm font-semibold text-card-foreground">Presets</h2>
      <div className="flex flex-wrap gap-2">
        {Object.entries(PRESETS).map(([key, preset]) => (
          <Button key={key} variant="outline" size="sm" onClick={() => onApply(preset)}>
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run tests and build**

Run: `cd apps/studio && bun test`
Expected: PASS (56 tests)

Run: `cd apps/studio && bun run lint`
Expected: 0 errors

Run: `cd apps/studio && bun run build`
Expected: build succeeds (this is the first point Tasks 8–11 are checked together as a
whole — `WorkSurface`'s import of `PresetPicker` now resolves)

- [ ] **Step 3: Manually verify in the browser**

Open the Style tab, click each preset button in turn. Confirm: both panels' controls update
to match the preset (font, colors, animation type and its options), the preview updates, a
single ~150ms opacity pulse plays across the Style tab content (confirm it does **not** play
with OS "reduce motion" enabled), and exactly one `⌘Z` undoes the entire preset application
back to the prior style+animation in one step (not one step per field).

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/subtitle/PresetPicker.tsx
git commit -m "feat(studio): add PresetPicker"
```

---

## Task 12: Export-fidelity notice

**Files:**
- Modify: `apps/studio/src/export/ExportDialog.tsx`

**Interfaces:**
- Consumes: `isClientExportSupported` (Task 7).

- [ ] **Step 1: Add the capability check**

In `apps/studio/src/export/ExportDialog.tsx`, add the import (alongside the existing local
imports):

```ts
import { isClientExportSupported } from "./exportCapability";
```

Replace:

```ts
  const percent = Math.round((progress?.progress ?? 0) * 100);
  const clientBlocked = mode === "client" && !isSupported;
```

with:

```ts
  const percent = Math.round((progress?.progress ?? 0) * 100);
  const clientBlocked = mode === "client" && !isSupported;
  const fidelity = isClientExportSupported(subtitles.style, subtitles.animation);
  const clientFidelityWarning = mode === "client" && !clientBlocked && !fidelity.supported;
```

- [ ] **Step 2: Surface the note in the existing info box**

The existing info box (the `else` branch of `clientBlocked ? (...) : (...)`, currently ending
in the "Video frames and subtitle animations are rendered..." paragraph) gets one appended
line — no new color/severity is introduced (the design system reserves amber for the
playhead/active-line and violet for edit affordances; this reuses the existing neutral
notice box). Replace:

```tsx
              <div className="rounded-lg bg-secondary/40 p-3 text-xs space-y-1.5 text-muted-foreground">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  {mode === "client" ? (
                    <HardDrive className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <ServerIcon className="h-3.5 w-3.5 text-primary" />
                  )}
                  <span>
                    {mode === "client" ? "Client-Side Fast Export" : "Server-Side Export"}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {mode === "client"
                    ? "Video frames and subtitle animations are rendered directly in your browser via WebCodecs. No video is uploaded to external servers."
                    : "Your video is uploaded temporarily to a render service, processed there, and the finished file is sent back to you."}
                </p>
              </div>
```

with:

```tsx
              <div className="rounded-lg bg-secondary/40 p-3 text-xs space-y-1.5 text-muted-foreground">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  {mode === "client" ? (
                    <HardDrive className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <ServerIcon className="h-3.5 w-3.5 text-primary" />
                  )}
                  <span>
                    {mode === "client" ? "Client-Side Fast Export" : "Server-Side Export"}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {mode === "client"
                    ? "Video frames and subtitle animations are rendered directly in your browser via WebCodecs. No video is uploaded to external servers."
                    : "Your video is uploaded temporarily to a render service, processed there, and the finished file is sent back to you."}
                </p>
                {clientFidelityWarning && (
                  <p className="mt-1.5 flex items-start gap-1.5 border-t border-border/60 pt-1.5 text-[11px] font-medium leading-relaxed text-foreground">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                    <span>{fidelity.reason}</span>
                  </p>
                )}
              </div>
```

(`AlertCircle` is already imported at the top of this file for the `clientBlocked` case — no
new import needed for this step.)

- [ ] **Step 3: Run tests**

Run: `cd apps/studio && bun test`
Expected: PASS (56 tests)

Run: `cd apps/studio && bun run lint`
Expected: 0 errors

Run: `cd apps/studio && bun run build`
Expected: build succeeds

- [ ] **Step 4: Manually verify in the browser**

Open Export, select Client mode with the default style/animation (`colorFill`/`hardCut`, no
gradient) — confirm no fidelity note appears. Switch the animation type to anything else
(e.g. Typewriter) or enable the text gradient — confirm the note appears with the expected
reason text, and the Start Export button stays enabled (this is a fidelity heads-up, not a
hard block, unlike the separate "WebCodecs not supported" case). Switch to Server mode —
confirm the note never appears there (server render is always accurate).

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/export/ExportDialog.tsx
git commit -m "feat(studio): surface a client-export fidelity notice"
```

---

## Final check

After Task 12, run the full gate used by every prior sub-project:

```bash
cd packages/engine && bun test   # expect 35 passing
cd apps/studio && bun test       # expect 56 passing
cd apps/studio && bun run lint   # expect 0 errors
cd apps/studio && bun run build  # expect success
```

Then do one last end-to-end browser pass covering everything in Tasks 8, 9, 11, and 12's
manual-verification steps in a single session (not just per-task in isolation), plus: undo
through a mixed sequence of style-field, animation-option, and preset changes and confirm
each `⌘Z` reverts exactly one of them.
