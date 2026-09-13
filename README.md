# Captionly 🎬✨

> **Professional Subtitle Spotting Studio & Kinetic Caption Engine**  
> Bring your own video, auto-transcribe with private on-device AI, spot and edit subtitle lines against footage on a vertical timeline, style kinetic text animations powered by Remotion, and export full-fidelity MP4s in-browser or on the server.

---

## ⚡ Overview

**Captionly** is an open-source, web-first subtitle editor and kinetic typography engine designed for creators, video editors, and broadcasters. 

Unlike traditional subtitle tools that bolt text onto a horizontal, cluttered video timeline, Captionly revolves around **spotting**—the broadcast craft of precision timing text against spoken footage. By rotating the timeline 90° into an interactive vertical transcript, Captionly pairs text editing directly with video playback.

Built as a high-performance monorepo using **Bun**, **Turborepo**, **React 19**, and **Remotion 4**, Captionly offers:
- 🎙️ **100% In-Browser Auto-Transcription**: Private, local Whisper AI transcription powered by WebGPU.
- 📐 **Vertical Transcript Timeline**: The transcript *is* the timeline—compact natural rows, live playhead sweep, and non-shifting boundary controls.
- ⚡ **Kinetic Remotion Animations**: 9 animated caption strategies ranging from word-by-word karaoke and bounce pop-on to retro split-flap boards and digital matrix glitches.
- 🔤 **Complete Google Fonts Catalog**: Live access to ~1,800+ Google Fonts with virtualized search and preview.
- 📱 **Resolution & Aspect-Ratio Independence**: Automatically scales typography, strokes, shadows, and padding across standard 16:9 landscape, 9:16 vertical (TikTok/Reels/Shorts), and 4K footage.
- 🚀 **Dual Export Engine**: Pure client-side export via WebCodecs (`@remotion/web-renderer`) with zero uploads, or headless server-side rendering with `@remotion/renderer`.

---

## 🌟 Key Features

### 1. The Vertical Transcript Timeline
- **No Bottom Timeline**: The transcript *is* the timeline. Subtitle line blocks are proportional to time, while an aligned ruler gutter visually weights active and selected states.
- **Natural Auto-Growing Rows**: Rows start at a compact single-line height and dynamically expand vertically via CSS `[field-sizing:content]` as you type.
- **Floating Boundary Controls**: Contextual boundary pills (`[ Merge | + Add line ]`) float between line gaps without introducing disruptive layout shifts.
- **Two-Way Synchronization**: Clicking any subtitle line seeks the video player to its In point; playback sweeps a live playhead across the active line and auto-scrolls the view without stealing input focus while typing.
- **Intelligent Word Timing Algorithm**: Character-weighted distribution with punctuation pause bonuses (`. , ! ?`) and an iterative water-filling floor (0.2s/word minimum) guarantees subtitles span their line's exact duration without drift.

### 2. Private In-Browser AI Transcription (Whisper + WebGPU)
- **Local On-Device Inference**: Runs OpenAI Whisper ONNX models locally in the browser via `@remotion/whisper-webgpu` and Web Audio API resampling.
- **Zero API Keys & Total Privacy**: No audio or video is ever uploaded to a third-party cloud service.
- **Model Tiers**:
  - `Base English` (~73 MB) — *Recommended*
  - `Tiny English` (~39 MB) — Fast and lightweight
  - `Small English` (~244 MB) — High accuracy
- **Persistent Model Caching**: Downloaded models are cached in browser `CacheStorage` for instant reuse.
- **Pacing Presets**:
  - **TikTok / Reels (Short-Form)**: Snappy 2–3 word lines (~1.4s) optimized for vertical mobile screens.
  - **Long-Form / YouTube (Standard)**: Natural full-sentence lines (~3.2s) optimized for landscape tutorials and vlogs.

### 3. Kinetic Animation Strategies
Powered by declarative Remotion React components in `@captionly/engine`:
| Animation | Description | Configurable Options |
|---|---|---|
| **None (Simple SRT)** | Clean, broadcast-standard subtitles | Flat active color, background pill |
| **Color Fill (Karaoke)** | Word-by-word active highlight | `hardCut` vs `gradient` fill transition |
| **Pop On (Bounce)** | Words bounce and pop into view | `popScale` (e.g. 1.2x), `popDuration` |
| **Typewriter** | Smooth typewriter text reveal | Cursor style (`_`, `\|`, `.`), blink rate, max CPS |
| **Wipe Reveal** | Clean directional wipe mask | Direction (`ltr`, `rtl`, `ttb`, `btt`) |
| **Roll Up** | Classic rolling karaoke teleprompter | Max visible lines, line spacing, soft transition |
| **Paint On** | Subtle character fade-in reveal | Direction (`ltr`, `rtl`), max CPS |
| **Split Flap Board** | Retro airport/train schedule board flip | Flap duration, cycles per character |
| **Digital Matrix** | Cyberpunk glitch and glow reveal | Glitch amplitude, glow intensity |

### 4. Typography, Styling & Safe Zones
- **~1,800+ Google Fonts**: Dynamic font loading with subset caching and virtualized fuzzy search.
- **One-Click Curated Presets**: Simple SRT, Bold Karaoke, Clean Minimal, Neon Glow, Typewriter, and Digital Matrix.
- **Deep Visual Controls**: Font size, weight, text color, active color, stroke/outline width, drop shadow / glow multiplier, container background fill & opacity, and padding.
- **Broadcast Safe Zones**: Overlay guidelines for TikTok (9:16), Instagram Reels (9:16), YouTube Shorts (9:16), and YouTube Landscape (16:9).

### 5. Flexible Export Pipeline
- **Client-Side WebCodecs**: Full Remotion composition rendered directly on your GPU using `@remotion/web-renderer`. No server required.
- **Headless Bun Render Service**: Microservice running `@remotion/bundler` and `@remotion/renderer` for batch jobs or server-side H.264 MP4 production.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Context | Action |
|---|---|---|
| `Space` | Global (when not editing text) | Toggle video play / pause |
| `Enter` | While line selected | Edit line / Add next line |
| `⌘ + Enter` / `Ctrl + Enter` | Inside line textarea | **Split line** at caret (at nearest word boundary) |
| `Backspace` / `Delete` | Line selected (not typing) | **Delete line** |
| `Esc` | Inside line textarea | Blur editor while maintaining line selection |
| `⌘ + Z` / `Ctrl + Z` | Global (outside inputs) | **Undo** last change |
| `⌘ + Shift + Z` / `Ctrl + Shift + Z` | Global (outside inputs) | **Redo** change |

---

## 🏗️ Repository Architecture

Captionly is structured as a Turborepo monorepo:

```text
captionly/
├── apps/
│   ├── studio/          # Web application (Vite + React 19 + TanStack Router + Tailwind v4)
│   │   ├── src/app/     # Studio shell, player rail, scrubber, and work surface tabs
│   │   ├── src/lines/   # Vertical transcript timeline, line rows, and playhead
│   │   ├── src/subtitle/# Style panel, animation panel, safe zones, and player
│   │   ├── src/export/  # Client (WebCodecs) and server video export dialogs
│   │   ├── src/transcribe/ # WebGPU Whisper transcription modal and converters
│   │   └── src/store/   # Zustand monorepo store (document, editor, history slices)
│   │
│   └── render/          # Headless Remotion rendering server & CLI (Bun + @remotion/renderer)
│       ├── src/server.ts# Bun HTTP server (POST /render)
│       ├── src/index.ts # CLI render entrypoint
│       └── src/probe.ts # Video duration and dimension probe helper
│
├── packages/
│   └── engine/          # Shared Remotion React subtitle engine & animation library
│       ├── src/animations/  # 9 kinetic animation renderers and strategy registry
│       ├── src/compositions/# MainComposition and SubtitleOverlay
│       ├── src/fonts/       # Google Fonts loader and catalogue
│       ├── src/utils/       # Geometry scaling, safe zones, and text styling
│       ├── src/wordTiming.ts# Word-timing distribution algorithm
│       └── src/presets.ts   # Built-in visual style and animation presets
│
└── docs/                # Architecture design specifications and roadmap documentation
```

### Monorepo Workspaces

| Workspace | Type | Description |
|---|---|---|
| [`@captionly/studio`](file:///Users/video/Desktop/captionly/apps/studio) | Web App | Primary browser-based editing environment. |
| [`@captionly/render`](file:///Users/video/Desktop/captionly/apps/render) | Microservice / CLI | Headless Remotion rendering engine and HTTP service. |
| [`@captionly/engine`](file:///Users/video/Desktop/captionly/packages/engine) | Core Package | Shared Remotion compositions, animations, fonts, and geometry. |

---

## 🛠️ Tech Stack

- **Runtime & Package Manager**: [Bun](https://bun.sh/) (v1.3.4+)
- **Monorepo Orchestration**: [Turborepo](https://turbo.build/repo)
- **UI Framework**: [React 19](https://react.dev/), [Vite 7](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/), [tw-animate-css](https://github.com/marceloprado/tw-animate-css), Radix UI / shadcn
- **Routing**: [TanStack Router](https://tanstack.com/router)
- **State Management**: [Zustand 5](https://github.com/pmndrs/zustand) (with snapshot history undo/redo and debounce coalescing)
- **Video & Animation**: [Remotion](https://www.remotion.dev/) (`@remotion/player`, `@remotion/web-renderer`, `@remotion/bundler`, `@remotion/renderer`)
- **AI Transcription**: [Whisper WebGPU](https://github.com/remotion-dev/whisper-webgpu) (`@remotion/whisper-webgpu`)
- **Media Encoding**: WebCodecs, MP4Box, MP4-Muxer

---

## 🚀 Getting Started

### Prerequisites

- **Bun** `>= 1.3.0` installed ([Install instructions](https://bun.sh/docs/installation))
- **Node.js** `20.19+` or `22.12+` (if running Node-based tools; Vite 7 requires modern Node crypto)
- **FFmpeg** (optional, recommended for the headless render server)
- A modern browser with **WebGPU** and **WebCodecs** support (Chrome 94+, Edge 94+, or Safari 16.4+)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/ayushsaha1018/captionly.git
cd captionly

# Install dependencies across all monorepo workspaces
bun install
```

### 2. Start the Development Studio

Launch the full-stack development environment:

```bash
bun run dev
```

Or run only the studio web frontend:

```bash
bun run dev:frontend
```

The Studio will be live at `http://localhost:5173`.

### 3. (Optional) Run the Headless Render Server

To enable server-side video rendering:

```bash
# In another terminal tab
cd apps/render
bun run dev
```

The render service will listen on `http://localhost:4000`.

---

## 🧪 Testing & Quality Assurance

Captionly has a comprehensive automated test suite testing word-timing distribution, state history snapshots, geometry scaling, font handling, and Whisper token segmentation:

```bash
# Run all tests across the monorepo
bun test

# Run tests with Turbo
bun run test

# Run linter
bun run lint
```

---

## 📖 Usage Guide

1. **Import Footage**:
   - Drag and drop any `.mp4`, `.webm`, or `.mov` video into the player rail, or click **Load Demo Video** to test with bundled sample footage.
2. **Generate Subtitles**:
   - Click **Auto-transcribe** to automatically generate word-level subtitle lines using local Whisper WebGPU AI.
   - Choose between **TikTok / Reels** (2–3 words/line) or **Standard / YouTube** (full sentences).
   - Alternatively, click **+ Add line** and type manually.
3. **Spot & Edit Timings**:
   - Adjust In / Out timecodes or drag the scrub bar to synchronize text with audio.
   - Use `⌘ + Enter` to split long phrases or the floating **Merge** button to join lines.
4. **Style Captions**:
   - Switch to the **Style** tab. Pick a preset or customize font, color, active word glow, stroke, and box background.
   - Select an animation style (e.g., Color Fill Karaoke, Pop On, Typewriter, or Split Flap).
   - Enable **Safe Zone** overlays (TikTok, Reels, YouTube Shorts) to ensure text isn't obscured by platform UI.
5. **Export**:
   - Click **Export** in the header.
   - Choose **Client** for fast, private in-browser rendering via WebCodecs.
   - Choose **Server** to render on the dedicated Remotion render service.
   - Download your finished H.264 MP4!

---

## 🤝 Contributing & Roadmap

Contributions, issues, and feature requests are welcome!

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
