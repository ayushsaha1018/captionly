# Client-Side Video & Subtitle Export Engine Design Spec

**Date:** 2026-08-20  
**Status:** Approved for Implementation Planning  
**Target:** `apps/studio` & `packages/engine` (or new export module)  

---

## 1. Overview & Problem Statement

Currently, subtitle rendering export relies on a Node/Bun backend pipeline (`apps/render`) that:
1. Rasterizes every frame (at 60 fps) to PNG buffers using Fabric.js and `node-canvas` / JSDOM.
2. Pipes thousands of uncompressed/PNG frames over `stdin` to an `ffmpeg` child process.
3. Encodes the composite video on CPU via `libx264`.

### Key Issues with Backend PNG Piping:
- **Severe TAT Bottleneck:** Compressing 1080p frames to PNG in JavaScript accounts for >80% of execution time.
- **High Memory & I/O Overhead:** Gigabytes of PNG data are generated and transferred over IPC.
- **Server Infrastructure Cost:** Rendering video on backend servers requires expensive CPU/GPU cloud instances.
- **Bandwidth & Latency:** Users must upload raw video files to a server and wait for download upon completion.

### Goal
Provide a **100% client-side (in-browser)**, zero-backend video export engine utilizing the **WebCodecs API (`VideoDecoder`, `VideoEncoder`)**, **`mp4box.js`** (demuxing), **`mp4-muxer`** (fast MP4 multiplexing), and **`OffscreenCanvas`** (compositing). The entire render occurs locally on the user's device in a dedicated Web Worker at speeds often 2x–5x faster than real-time.

---

## 2. Architecture & Pipeline Dataflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Web Worker Thread                               │
│                                                                             │
│  [ Input Video File (File / ArrayBuffer) ]                                  │
│                      │                                                      │
│                      ▼                                                      │
│              mp4box.js Demuxer                                              │
│          ┌───────────┴───────────┐                                          │
│          │                       │                                          │
│          ▼                       ▼                                          │
│    Video Track Samples     Audio Track Samples (AAC)                        │
│          │                       │                                          │
│          ▼                       │                                          │
│    VideoDecoder                  │ (Lossless Passthrough)                   │
│    (Hardware / Software)         │                                          │
│          │                       │                                          │
│          ▼                       │                                          │
│    Decoded VideoFrame            │                                          │
│          │                       │                                          │
│          ▼                       │                                          │
│    OffscreenCanvas (2D)          │                                          │
│    1. ctx.drawImage(frame)       │                                          │
│    2. SubtitleRenderer.render(t) │                                          │
│          │                       │                                          │
│          ▼                       │                                          │
│    Canvas -> VideoFrame          │                                          │
│          │                       │                                          │
│          ▼                       │                                          │
│    VideoEncoder                  │                                          │
│    (prefer-hardware)             │                                          │
│          │                       │                                          │
│          ▼                       ▼                                          │
│    Encoded Chunks          Audio Chunks                                     │
│          └───────────┬───────────┘                                          │
│                      ▼                                                      │
│                  mp4-muxer                                                  │
│                      │                                                      │
│                      ▼                                                      │
│              Exported MP4 Blob                                              │
└──────────────────────┬──────────────────────────────────────────────────────┘
                       │ (postMessage / Transferable ArrayBuffer)
                       ▼
             [ Main UI Thread / Browser Download ]
```

---

## 3. Detailed Component Specifications

### 3.1 Demuxer (`mp4box.js`)
- **Input:** Raw `File` or `ArrayBuffer` slice.
- **Responsibilities:**
  - Parse MP4 box headers to extract video parameters: width, height, frame rate, duration, and codec configuration string (`avc1.xxxxxx`).
  - Extract the `avcC` box (decoder configuration / SPS / PPS metadata) required to initialize `VideoDecoder`.
  - Extract compressed audio samples (AAC) along with their presentation timestamps (`dts`, `cts`, `duration`).

### 3.2 Video Decoder (`VideoDecoder`)
- **Configuration:**
  ```ts
  const decoder = new VideoDecoder({
    output: handleDecodedFrame,
    error: handleDecoderError,
  });
  decoder.configure({
    codec: videoTrack.codec, // e.g. 'avc1.4d002a'
    description: videoTrack.description, // avcC box Uint8Array
    hardwareAcceleration: 'prefer-hardware',
  });
  ```
- **Frame Processing:** Converts `EncodedVideoChunk` into native `VideoFrame` objects at maximum hardware decode throughput.

### 3.3 Frame Compositor (`OffscreenCanvas` + `@captionly/engine`)
- **Dimensions:** Matches the source video's native resolution (e.g. 1080×1920 or 1920×1080).
- **Execution per frame:**
  1. `ctx.drawImage(decodedVideoFrame, 0, 0, width, height)`
  2. Call `subtitleRenderer.render(timestampInSeconds)` to draw the word-by-word highlighted text, background pill, and animation transforms onto the canvas.
  3. Close the input `decodedVideoFrame` (`decodedVideoFrame.close()`).
  4. Create a new `VideoFrame` from the composited `OffscreenCanvas`:
     ```ts
     const compositedFrame = new VideoFrame(offscreenCanvas, {
       timestamp: frameTimestampMicros,
       duration: frameDurationMicros,
     });
     ```
  5. Pass `compositedFrame` to `VideoEncoder.encode()`, then call `compositedFrame.close()`.

### 3.4 Video Encoder (`VideoEncoder`)
- **Configuration:**
  ```ts
  const encoder = new VideoEncoder({
    output: handleEncodedChunk,
    error: handleEncoderError,
  });
  encoder.configure({
    codec: 'avc1.4d002a', // H.264 Main/High Profile Level 4.2
    width: videoWidth,
    height: videoHeight,
    bitrate: calculateBitrate(videoWidth, videoHeight, fps), // e.g. 10–14 Mbps for 1080p60
    framerate: fps,
    hardwareAcceleration: 'prefer-hardware', // Falls back to software if hardware chip absent
  });
  ```

### 3.5 Audio Handling & Muxing (`mp4-muxer`)
- **Lossless Audio Passthrough:** The original AAC audio track is passed directly into `mp4-muxer` without decoding or re-encoding, preserving 100% audio fidelity and adding 0ms audio transcoding latency.
- **Muxer Setup:**
  ```ts
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: videoWidth,
      height: videoHeight,
    },
    audio: hasAudio ? {
      codec: 'aac',
      numberOfChannels: audioTrack.channels,
      sampleRate: audioTrack.sampleRate,
    } : undefined,
    fastStart: 'in-memory',
  });
  ```
- **Output:** Produces a standard, fragmented or fast-start MP4 `ArrayBuffer` ready for download as a `Blob`.

---

## 4. Web Worker Orchestration & Main Thread Communication

### 4.1 Message Protocol

#### Main Thread → Worker:
```ts
type StartExportMessage = {
  type: 'START_EXPORT';
  videoFile: File;
  subtitles: {
    lines: SubtitleLine[];
    style: SubtitleStyle;
    position: SubtitlePosition;
    animation: AnimationConfig;
  };
  options?: {
    bitrate?: number;
    fps?: number;
  };
};

type CancelExportMessage = {
  type: 'CANCEL_EXPORT';
};
```

#### Worker → Main Thread:
```ts
type ProgressMessage = {
  type: 'PROGRESS';
  progress: number;          // 0.0 to 1.0
  currentFrame: number;
  totalFrames: number;
  fps: number;               // Current rendering speed
  estimatedRemainingSec: number;
};

type CompleteMessage = {
  type: 'COMPLETE';
  buffer: ArrayBuffer;
  duration: number;
  fileSize: number;
};

type ErrorMessage = {
  type: 'ERROR';
  message: string;
  errorDetails?: string;
};
```

---

## 5. Performance, Memory & Backpressure Management

1. **Explicit Resource Disposal (`VideoFrame.close()`):**
   `VideoFrame` objects hold direct references to GPU/shared memory. Every input frame and composited frame must be closed immediately after being drawn or encoded.
2. **Encoder Backpressure:**
   If the `VideoDecoder` outputs frames faster than `VideoEncoder` can compress them, the worker throttles chunk feeding whenever `encoder.encodeQueueSize > 5` until the queue drops.
3. **Non-Blocking UI:**
   All demuxing, decoding, canvas drawing, encoding, and muxing execute exclusively in the Web Worker. The Studio UI remains completely interactive at 60 fps during export.

---

## 6. Hardware Compatibility & Fallbacks

- **Dedicated GPU Not Required:**
  - Modern integrated GPUs (Intel QuickSync, Apple Silicon Media Engine, AMD VCN) are automatically utilized.
  - On devices without hardware encoders (e.g. basic VMs or older CPUs), `hardwareAcceleration: 'prefer-hardware'` automatically falls back to browser-bundled software codecs (OpenH264 / libvpx).
- **Supported Browsers:**
  - Chrome 94+, Edge 94+, Safari 16.4+, Opera, Firefox 130+.
- **Feature Detection Helper:**
  ```ts
  export function isClientExportSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'VideoEncoder' in window &&
      'VideoDecoder' in window &&
      'OffscreenCanvas' in window
    );
  }
  ```

---

## 7. Future Extensibility: In-Browser Transcription (Whisper)

- **Audio Extraction:** Can use native browser `OfflineAudioContext(1, 16000 * duration, 16000).decodeAudioData()` to extract 16kHz mono Float32 PCM directly.
- **Model Integration:** `@huggingface/transformers` (v3) running `onnx-community/whisper-tiny` or `whisper-base` with WebGPU acceleration (and CPU WASM fallback).
- **Word Timestamps:** Whisper's word-level timestamps map directly to Captionly's `SubtitleLine` and `Word` schema.

---

## 8. Verification & Testing Plan

1. **Unit / Integration Tests:**
   - Verify `mp4box.js` metadata extraction on standard 1080p, 4K, 16:9, and 9:16 MP4 test fixtures.
   - Verify `mp4-muxer` generates valid MP4 containers playable in QuickTime, Chrome, and VLC.
2. **Performance Benchmarks:**
   - Benchmark a 30s 1080p60 video export on Apple Silicon and Intel/Windows machines (Target: <10 seconds total export time).
3. **Visual Fidelity Verification:**
   - Verify subtitle positioning, font scaling, animations (Typewriter, PopOn, Wipe, etc.), and alpha transparency overlay match the Studio canvas preview frame-for-frame.
