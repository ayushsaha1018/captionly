# Remotion Subtitle Engine Migration Design Spec

**Date:** 2026-08-24  
**Status:** Approved for Implementation Planning  
**Target:** `packages/engine`, `apps/studio`, `apps/render`

---

## 1. Overview & Problem Statement

Captionly currently relies on **Fabric.js** (`@captionly/engine`) for subtitle rendering across both preview and export. While functional, this approach introduces significant architectural friction and limitations:

1. **Styling & Motion Constraints:** Building modern video caption effects (spring physics, bouncy pop-ins, glowing highlights, multi-line wrap styling, emoji rendering) requires tedious low-level canvas drawing and manual string layout calculations in Fabric.
2. **Dual-Stack & State Synchronization Friction:** The Studio UI manages React state for styles, positions, and animations, but must imperatively mutate and invalidate a Fabric.js canvas object graph in a continuous 60fps `requestAnimationFrame` loop.
3. **Web Worker Hack Overheads:** Client-side WebCodecs export in Web Workers requires mocking global DOM objects (`window`, `document`, `HTMLCanvasElement`) via polyfills to trick Fabric into running in headless worker contexts.
4. **Native Backend Dependencies:** Server-side rendering in `apps/render` depends on `node-canvas` (Cairo/Pango C++ bindings), which complicates CI/CD and cross-platform deployments.

### Goal

Migrate Captionly's subtitle rendering and video export engine to **Remotion**:
- **Pure Declarative React Components:** Author subtitle layouts and animations using standard JSX, Tailwind/CSS, and Remotion hooks (`useCurrentFrame()`, `spring()`, `interpolate()`).
- **Unified Preview & Export Parity:** Use `@remotion/player` for 60fps frame-synced Studio preview and `@remotion/webcodecs` for in-browser, zero-backend, hardware-accelerated client-side MP4 export.
- **Dependency Elimination:** Remove `fabric`, `node-canvas`, and Web Worker DOM polyfills completely.

---

## 2. Monorepo Architecture & Package Boundaries

```
captionly/
├── packages/
│   └── engine/                             # Core Subtitle & Video Compositions
│       ├── src/
│       │   ├── compositions/
│       │   │   ├── MainComposition.tsx    # Video Track + Subtitle Overlay
│       │   │   └── SubtitleOverlay.tsx    # Responsive Subtitle Box & Layout
│       │   ├── animations/
│       │   │   ├── ColorFillAnimation.tsx # Word-by-word active highlight
│       │   │   ├── PopOnAnimation.tsx     # Bouncy spring entrance
│       │   │   ├── TypewriterAnimation.tsx# Character reveal + blinking cursor
│       │   │   ├── WipeAnimation.tsx      # Clip-path gradient reveal
│       │   │   ├── RollUpAnimation.tsx    # Multi-line karaoke scroll
│       │   │   └── registry.tsx           # Dynamic animation strategy picker
│       │   ├── types.ts                   # SubtitleLine, Word, Style, AnimationConfig
│       │   ├── sampleData.ts              # Default subtitle demo data
│       │   └── index.ts                   # Exported React components & schemas
│
├── apps/
│   ├── studio/                             # TanStack Start / React 19 Frontend
│   │   ├── src/
│   │   │   ├── subtitle/
│   │   │   │   ├── StudioPlayer.tsx        # Embeds @remotion/player
│   │   │   │   ├── StylePanel.tsx          # Subtitle typography & color controls
│   │   │   │   ├── AnimationPanel.tsx      # Preset selector & timing controls
│   │   │   │   └── SafeZones.tsx           # Platform margin overlays
│   │   │   └── export/
│   │   │       ├── useVideoExport.ts       # Client-side renderMediaOnWeb hook
│   │   │       ├── useServerVideoExport.ts # Server-side fetch fallback hook
│   │   │       └── ExportDialog.tsx        # Export UI modal with progress & download
│
└── apps/render/                            # Optional Bun Server-Side Render Service
    └── src/
        ├── remotionRoot.tsx                # Remotion composition entrypoint
        └── server.ts                       # HTTP POST /render -> @remotion/renderer
```

---

## 3. Engine Design (`packages/engine`)

### 3.1 Data Types & Contracts (`src/types.ts`)

Data interfaces remain clean, JSON-serializable, and decoupled from framework internals:

```ts
export type Word = {
  id: string;
  text: string;
  start: number; // Seconds
  end: number;   // Seconds
};

export type SubtitleLine = {
  id: string;
  start: number;
  end: number;
  words: Word[];
};

export type SubtitleStyle = {
  fontFamily: string;
  fontWeight: 400 | 600 | 700 | 900;
  fontSize: number;
  color: string;
  activeColor: string;
  stroke: string;
  strokeWidth: number;
  activeScale: number;
  shadowBlur: number;
  boxWidth: number;
  boxAnchor: "top" | "bottom" | "center";
  bgColor: string;
  bgOpacity: number;
  bgRadius: number;
  bgPaddingX: number;
  bgPaddingY: number;
};

export type SubtitlePosition = {
  x: number; // Percentage (0..100) or canvas px
  y: number; // Percentage (0..100) or canvas px
};

export type AnimationType =
  | "colorFill"
  | "popOn"
  | "typewriter"
  | "wipe"
  | "rollUp";

export type AnimationConfig = {
  type: AnimationType;
  options: Record<string, unknown>;
};

export interface SubtitleCompositionProps {
  videoSrc?: string;
  subtitles: {
    lines: SubtitleLine[];
    style: SubtitleStyle;
    position: SubtitlePosition;
    animation: AnimationConfig;
  };
}
```

### 3.2 Main Composition (`src/compositions/MainComposition.tsx`)

```tsx
import React from "react";
import { AbsoluteFill, Video } from "remotion";
import { SubtitleOverlay } from "./SubtitleOverlay";
import type { SubtitleCompositionProps } from "../types";

export const MainComposition: React.FC<SubtitleCompositionProps> = ({
  videoSrc,
  subtitles,
}) => {
  return (
    <AbsoluteFill className="bg-black">
      {videoSrc && (
        <Video
          src={videoSrc}
          className="w-full h-full object-contain"
        />
      )}
      <SubtitleOverlay
        lines={subtitles.lines}
        style={subtitles.style}
        position={subtitles.position}
        animation={subtitles.animation}
      />
    </AbsoluteFill>
  );
};
```

### 3.3 Declarative Animation Strategies

Each animation style is a React component driven by Remotion frame hooks:

1. **`ColorFillAnimation`:**
   - Active word detection based on `time = frame / fps`.
   - Scale popping via `spring({ frame: frame - wordStartFrame, fps, config: { damping: 12 } })`.
   - Color transition between `style.color` and `style.activeColor`.
2. **`PopOnAnimation`:**
   - Individual words bounce in with spring overshoot when their timestamp is reached.
3. **`TypewriterAnimation`:**
   - Calculates revealed character length proportional to elapsed word duration + renders blinking cursor.
4. **`WipeAnimation`:**
   - Applies dynamic CSS `clip-path: inset(0 ... 0 0)` or horizontal linear-gradient masks across active lines.

---

## 4. Studio Player & Real-time Synchronization (`apps/studio`)

### 4.1 Remotion Player Integration (`StudioPlayer.tsx`)

Replace custom `<video>` tag and imperative render loops with `@remotion/player`:

```tsx
import React from "react";
import { Player, PlayerRef } from "@remotion/player";
import { MainComposition, type SubtitleCompositionProps } from "@captionly/engine";

interface StudioPlayerProps {
  videoSrc: string;
  durationInFrames: number;
  fps: number;
  subtitles: SubtitleCompositionProps["subtitles"];
  playerRef?: React.RefObject<PlayerRef | null>;
}

export function StudioPlayer({
  videoSrc,
  durationInFrames,
  fps,
  subtitles,
  playerRef,
}: StudioPlayerProps) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10 aspect-video">
      <Player
        ref={playerRef}
        component={MainComposition}
        inputProps={{
          videoSrc,
          subtitles,
        }}
        durationInFrames={durationInFrames}
        compositionWidth={1920}
        compositionHeight={1080}
        fps={fps}
        controls
        loop
        className="w-full h-full"
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}
```

### 4.2 Reactive Studio State Flow
- **Style & Animation Updates:** Modifying controls in `StylePanel` or `AnimationPanel` updates the parent state in `SubtitleEditor.tsx`, automatically passing new `inputProps` to the Remotion `<Player />`.
- **Zero Lag Frame Updates:** Remotion handles instantaneous frame invalidation and scrubbing with full audio/video sync.

---

## 5. Client-Side Video Export (`@remotion/webcodecs`)

### 5.1 In-Browser Export Pipeline (`apps/studio/src/export/useVideoExport.ts`)

Client-side rendering is executed directly in the browser via WebCodecs using `@remotion/webcodecs`:

```ts
import { renderMediaOnWeb } from "@remotion/webcodecs";
import { MainComposition } from "@captionly/engine";
import type { SubtitleExportData, ExportProgress } from "./types";

export async function exportVideoClientSide({
  videoSrc,
  durationInFrames,
  fps,
  width,
  height,
  subtitles,
  onProgress,
  signal,
}: {
  videoSrc: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  subtitles: SubtitleExportData;
  onProgress: (p: ExportProgress) => void;
  signal?: AbortSignal;
}): Promise<Blob> {
  const result = await renderMediaOnWeb({
    composition: {
      component: MainComposition,
      durationInFrames,
      fps,
      width,
      height,
    },
    inputProps: {
      videoSrc,
      subtitles,
    },
    licenseKey: "free-license",
    container: "mp4",
    videoCodec: "h264",
    audioCodec: "aac",
    hardwareAcceleration: "prefer-hardware",
    onProgress: ({ progress, renderedFrames, encodedFrames }) => {
      onProgress({
        phase: "rendering",
        progress,
        currentFrame: encodedFrames,
        totalFrames: durationInFrames,
        fps: 0,
        estimatedRemainingSec: 0,
      });
    },
  });

  return new Blob([result.buffer], { type: "video/mp4" });
}
```

### 5.2 Licensing Declaration
- Pass `licenseKey: 'free-license'` in both client and server export configurations. This declares eligibility under the Remotion Free License (individuals and teams of ≤3 people).

---

## 6. Server-Side Export Fallback (`apps/render`)

If the user selects the **Server** export toggle in `ExportDialog.tsx`:
1. `apps/render/src/server.ts` accepts `POST /render` with `video` and `subtitles`.
2. Bundles the composition using `@remotion/bundler`.
3. Renders via `@remotion/renderer` (`renderMedia` with `licenseKey: 'free-license'`).
4. Streams the rendered MP4 back to the client.

---

## 7. Migration & Cleanup Plan

### 7.1 Packages to Remove
- `fabric` (from root, `packages/engine`, `apps/studio`, `apps/render`)
- `canvas` (`node-canvas` from `apps/render`)
- `apps/studio/src/export/worker-polyfill.ts`
- `apps/studio/src/export/compositor.ts`
- `packages/engine/src/animations/helpers.ts` (Fabric text measurement hacks)

### 7.2 Packages to Add
- `remotion` (in `packages/engine`, `apps/studio`)
- `@remotion/player` (in `apps/studio`)
- `@remotion/webcodecs` (in `apps/studio`)
- `@remotion/renderer`, `@remotion/bundler` (in `apps/render`)

---

## 8. Verification & Testing Strategy

1. **Visual Parity Test:**
   - Verify that animated subtitles in Remotion `<Player />` match preview positioning and font styling frame-by-frame.
2. **Client-Side Export Benchmark:**
   - Export a 1080p 30-second sample video on Chrome/Safari. Assert that the exported MP4 contains crisp subtitle overlays, synchronized audio, and downloads properly.
3. **Animation Accuracy Tests:**
   - Verify word-by-word active highlighting in `ColorFillAnimation` and bounce physics in `PopOnAnimation` trigger at exact word timestamps.
4. **Server Fallback Verification:**
   - Test `POST /render` on `apps/render` to ensure server-mode fallback succeeds and returns a valid MP4 file.
