# Sub-Project 2 — Video In & Resolution-Independent Styling Design Spec

**Date:** 2026-09-05  
**Status:** Approved for Implementation Planning  
**Sub-Project:** SP2 of Frontend Revamp Program (ref: `docs/superpowers/ROADMAP-frontend-revamp.md`)  
**Scope:** `apps/studio`, `packages/engine`

---

## 1. Overview & Problem Statement

In SP1, Captionly established the foundation for the studio: a reactive document store with undo/redo snapshotting, a sticky player rail, and the tabbed work surface. However, SP1 ran on a hardcoded fixture (`apps/studio/src/store/fixture.ts`) hardwired to `/test1.mp4` at fixed $1920 \times 1080$ dimensions with preset subtitle lines.

Furthermore, existing subtitle styling values in `@captionly/engine` (`fontSize: 48`, `boxWidth: 1400`, paddings, radius) assume an absolute $1920 \times 1080$ landscape canvas. When a user uploads a vertical $1080 \times 1920$ (9:16) video:
1. `boxWidth: 1400` exceeds the entire frame width ($1080\text{px}$), causing captions to clip or push past canvas boundaries.
2. In `apps/studio/src/export/subtitleDrawer.ts`, scaling was hardcoded as `scale = width / 1920`, causing a vertical $1080\text{px}$ video to shrink the font to $56\%$ ($27\text{px}$).
3. In `packages/engine/src/compositions/SubtitleOverlay.tsx`, there was no resolution scaling, causing 4K videos ($3840 \times 2160$) to render captions at half their proportional size.
4. No real-world video upload or dropzone exists; the studio cannot ingest arbitrary user footage.

### Goals
- Allow users to drag-and-drop or browse any standard video file (`MP4`, `WebM`, `MOV`).
- Automatically extract duration, width, and height via native browser APIs.
- Adapt Remotion composition dimensions and PlayerRail layout dynamically to any aspect ratio (16:9, 9:16, 1:1, etc.).
- Establish a unified, resolution-independent scaling model shared identically between Remotion preview/server render and client 2D canvas export.
- Provide clean empty states when no video is loaded, along with a "Load Demo Video" affordance.
- Delete `apps/studio/src/store/fixture.ts` completely.

### Non-Goals (Out of Scope for SP2)
- Line editing (add, split, merge, retime) and the word-timing algorithm (deferred to **SP3 — Line Editor**).
- Restyling `StylePanel` and `AnimationPanel` onto shadcn (deferred to **SP4 — Style System**).
- Heavy client-side transcoding or ffmpeg.wasm demuxing (YAGNI / Ponytail: rely on native browser video decoding).
- Multi-video timelines or video trimming (Captionly spots captions against single video files).

---

## 2. Ingest Pipeline & Metadata Extraction

### 2.1 Metadata Extraction Helper (`apps/studio/src/lib/videoMeta.ts`)
A dedicated, lightweight helper extracts metadata using an offscreen HTML5 `<video>` element:

```ts
export interface VideoMeta {
  src: string;
  durationSec: number;
  width: number;
  height: number;
  file?: File;
  isDemo?: boolean;
}

export async function extractVideoMetadata(fileOrUrl: File | string): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const isFile = typeof fileOrUrl !== "string";
    const src = isFile ? URL.createObjectURL(fileOrUrl) : fileOrUrl;

    const video = document.createElement("video");
    video.preload = "metadata";

    // 10-second watchdog timeout for corrupt or hung media
    const timer = setTimeout(() => {
      cleanup();
      if (isFile) URL.revokeObjectURL(src);
      reject(new Error("Timed out reading video metadata. Please ensure the file is a valid video."));
    }, 10000);

    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
      video.src = "";
    };

    const onLoaded = () => {
      const durationSec = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      cleanup();

      if (!durationSec || isNaN(durationSec) || durationSec <= 0 || !width || !height) {
        if (isFile) URL.revokeObjectURL(src);
        reject(new Error("Invalid video dimensions or duration."));
        return;
      }

      resolve({
        src,
        durationSec,
        width,
        height,
        file: isFile ? fileOrUrl : undefined,
        isDemo: !isFile,
      });
    };

    const onError = () => {
      cleanup();
      if (isFile) URL.revokeObjectURL(src);
      reject(new Error("Unable to decode video. Format may not be supported by this browser."));
    };

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("error", onError);
    video.src = src;
  });
}
```

### 2.2 Memory Management & URL Revocation
- When uploading a new file while a `blob:` URL is already active, the store invokes `URL.revokeObjectURL(previousBlobUrl)` to prevent browser memory leaks.
- Demo files (`/test1.mp4`) are static strings and are not revoked.

---

## 3. Store Updates & State Management

### 3.1 Type Definitions (`apps/studio/src/store/types.ts`)
Update `VideoMeta` to include optional `file?: File` and `isDemo?: boolean`:

```ts
export interface VideoMeta {
  src: string;
  durationSec: number;
  width: number;
  height: number;
  file?: File;
  isDemo?: boolean;
}

export interface DocumentSnapshot {
  video: VideoMeta | null;
  lines: SubtitleLine[];
  style: SubtitleStyle;
  animation: AnimationConfig;
  position: SubtitlePosition;
}

export interface DocumentSlice extends DocumentSnapshot {
  loadVideo: (meta: VideoMeta, lines?: SubtitleLine[]) => void;
  setStyle: (patch: Partial<SubtitleStyle>) => void;
  setAnimation: (a: AnimationConfig) => void;
  setPosition: (p: SubtitlePosition) => void;
  replaceDocument: (doc: DocumentSnapshot) => void;
}
```

### 3.2 Document Slice Implementation (`apps/studio/src/store/documentSlice.ts`)
- Initial state starts clean without `SP1_FIXTURE`:
  ```ts
  video: null,
  lines: [],
  style: defaultStyle,
  animation: defaultAnimation,
  position: defaultPosition,
  ```
- `loadVideo` implementation:
  - Snapshots current state: `get().commit("Load video")`.
  - Revokes old `blob:` URL if `state.video?.src.startsWith("blob:")`.
  - Sets `video: meta`.
  - If `lines` is provided (e.g. demo mode), hydrates `lines: lines`. Otherwise, resets `lines: []`.

### 3.3 Fixture Deletion
- Delete `apps/studio/src/store/fixture.ts`.
- Remove all imports of `SP1_FIXTURE`.

---

## 4. Resolution-Independent Styling & Pure Geometry Engine

### 4.1 Base Reference Model (`packages/engine/src/utils/geometry.ts`)
The scaling model uses $1080\text{px}$ as the universal base reference dimension (the short dimension of standard HD 1080p, vertical 9:16, and square 1:1 formats).

```ts
/**
 * Calculates a resolution scale factor relative to a standard 1080p base dimension.
 * For 1920x1080: base = 1080, scale = 1.0
 * For 1080x1920: base = 1080, scale = 1.0
 * For 3840x2160 (4K): base = 2160, scale = 2.0
 * For 720x1280 (720p vertical): base = 720, scale = 0.667
 */
export function getResolutionScale(width: number, height: number): number {
  const baseDim = Math.min(width, height);
  return baseDim / 1080;
}

/**
 * Calculates responsive bounding metrics for subtitle layout.
 */
export function calculateSubtitleLayout(
  width: number,
  height: number,
  boxWidthSetting: number = 1400,
) {
  const scale = getResolutionScale(width, height);
  // Cap max box width to 88% of canvas width to guarantee horizontal padding
  const maxWidth = Math.min(boxWidthSetting * scale, width * 0.88);

  return {
    scale,
    maxWidth,
  };
}
```

### 4.2 Engine Component Integration (`packages/engine/src/compositions/SubtitleOverlay.tsx`)
In `SubtitleOverlay.tsx`:
```tsx
const { fps, width, height } = useVideoConfig();
const { scale, maxWidth } = calculateSubtitleLayout(width, height, style.boxWidth);

const scaledFontSize = Math.round(style.fontSize * scale);
const scaledPadX = Math.round((style.bgPaddingX ?? 24) * scale);
const scaledPadY = Math.round((style.bgPaddingY ?? 12) * scale);
const scaledRadius = Math.round((style.bgRadius ?? 16) * scale);
const scaledStroke = Math.round((style.strokeWidth ?? 0) * scale);
```
These scaled dimensions apply to the root subtitle box and its background container.

### 4.3 Canvas Client Export Integration (`apps/studio/src/export/subtitleDrawer.ts`)
Replace the legacy `scale = width / 1920` with:
```ts
const { scale, maxWidth } = calculateSubtitleLayout(width, height, style.boxWidth);
const fontSize = Math.round(style.fontSize * scale);
const padX = (style.bgPaddingX || 24) * scale;
const padY = (style.bgPaddingY || 12) * scale;
const bgRadius = (style.bgRadius || 16) * scale;
```
Ensures 100% visual parity between Remotion preview and client-side canvas render.

---

## 5. UI & Component Architecture

### 5.1 PlayerRail (`apps/studio/src/app/PlayerRail.tsx`)
- **Empty State (`video === null`)**:
  - Displays a dropzone card with dashed border (`border-hairline`, active drag `border-edit`).
  - Native hidden `<input type="file" accept="video/mp4,video/webm,video/quicktime">`.
  - Icon, title ("Drop video file or Browse"), format labels ("MP4, WebM, MOV up to 4K").
  - "Load Demo Video" button triggering `/test1.mp4` extraction with `sampleSubtitles`.
  - Ingest spinner when processing metadata.
  - Inline error alert if file reading fails.
- **Active State (`video !== null`)**:
  - Sets rail width based on aspect ratio: `width: clamp(280px, aspect >= 1 ? "42vw" : "24vw", 640px)`.
  - Renders `StudioPlayer` with `compositionWidth={video.width}` and `compositionHeight={video.height}`.
  - Adds a "Replace video" action button alongside playhead controls.

### 5.2 WorkSurface & LineList (`apps/studio/src/lines/LineList.tsx`)
- **Lines Tab**:
  - When `video === null`: renders a calm placeholder:
    *"No video loaded yet. Drop a video in the player rail or load the demo project to begin spotting."*
- **Style Tab**:
  - Fully enabled at all times, allowing styling configuration before or after video load.

### 5.3 SafeZones Overlay (`apps/studio/src/subtitle/SafeZones.tsx`)
- Default preset remains `none`.
- In `PlayerRail` and `StylePanel`, the preset dropdown groups recommendations by video aspect:
  - Vertical ($< 1.0$): `TikTok 9:16`, `Instagram Reels 9:16` at top.
  - Landscape ($\ge 1.0$): `YouTube 16:9` at top.

### 5.4 Studio Header (`apps/studio/src/app/StudioShell.tsx`)
- When `video === null`:
  - Header displays "Captionly" without video stats.
  - Export button is disabled (`disabled={!video}`).
- When `video !== null`:
  - Displays filename, resolution (`width × height`), and formatted duration timecode.
  - Export button is enabled.

---

## 6. Export Parity & Integration

### 6.1 Export Dialog Passthrough (`apps/studio/src/export/ExportDialog.tsx`)
- Pass `video.file ?? video.src` to `useVideoExport` and `useServerVideoExport`.
- In `useServerVideoExport.ts`:
  - When `videoSource` is an instance of `File`, append directly to `FormData`:
    `form.append("video", videoSource, videoSource.name);`
    avoids unnecessary `fetch(blobUrl)` conversions.
- In `useVideoExport.ts`:
  - Dynamic frame sizing via `frame.displayWidth || frame.codedWidth`.

---

## 7. Testing & Verification Strategy

### 7.1 Automated Unit Tests
- `packages/engine/src/utils/geometry.test.ts`:
  - 16:9 ($1920 \times 1080$): `scale = 1.0`, `maxWidth = 1400`.
  - 9:16 ($1080 \times 1920$): `scale = 1.0`, `maxWidth = 950.4`.
  - 4K ($3840 \times 2160$): `scale = 2.0`, `fontSize = 96`.
  - 720p vertical ($720 \times 1280$): `scale = 0.667`, `maxWidth = 633.6`.
  - 1:1 square ($1080 \times 1080$): `scale = 1.0`, `maxWidth = 950.4`.
- `apps/studio/src/store/documentSlice.test.ts`:
  - `loadVideo` records an undo snapshot.
  - `loadVideo` cleans up prior `blob:` URLs.
  - `loadVideo` resets lines unless explicit demo lines are provided.

### 7.2 Manual Browser Verification Gates
1. **Cold Start**: Open studio, verify empty dropzone, empty lines placeholder, disabled export button.
2. **Demo Loader**: Click "Load Demo Video", verify `/test1.mp4` mounts, duration displays $15\text{s}$, sample subtitles appear.
3. **9:16 Vertical Upload**: Drop a vertical video, verify player rail resizes to vertical proportion ($24\text{vw}$), captions wrap within $88\%$ width and do not overflow.
4. **Undo / Redo**: Hit `⌘Z` after upload to verify return to previous state.
5. **Safe Zones**: Select TikTok 9:16 on vertical video, verify dashed bounds fit correctly.
6. **Export**: Open export dialog, verify video source passes through without errors.

---

## 8. Exit Criteria for SP2

- [ ] A vertical 9:16 upload renders correctly, captions sized sensibly, safe zones correct.
- [ ] [`apps/studio/src/store/fixture.ts`](file:///Users/video/Desktop/captionly/apps/studio/src/store/fixture.ts) is deleted.
- [ ] No memory leaks from `URL.createObjectURL`.
- [ ] All lint and unit tests pass with 0 errors.
