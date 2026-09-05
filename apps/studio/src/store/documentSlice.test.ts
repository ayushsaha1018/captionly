import { describe, expect, it, beforeEach, spyOn } from "bun:test";
import { defaultStyle, defaultAnimation, defaultPosition } from "@captionly/engine";
import { useStudioStore } from "./index";
import type { VideoMeta } from "./types";

describe("documentSlice loadVideo", () => {
  beforeEach(() => {
    useStudioStore.setState({
      video: null,
      lines: [],
      style: defaultStyle,
      animation: defaultAnimation,
      position: defaultPosition,
      past: [],
      future: [],
      selectedLineId: null,
      editingLineId: null,
    });
  });

  it("initializes with null video and empty lines", () => {
    const state = useStudioStore.getState();
    expect(state.video).toBeNull();
    expect(state.lines).toEqual([]);
  });

  it("loads a video, resets lines by default, and records an undo snapshot", () => {
    // Pre-populate some lines and selection
    useStudioStore.setState({
      lines: [{ id: "existing", start: 0, end: 1, words: [] }],
      selectedLineId: "existing",
      editingLineId: "existing",
    });

    const meta: VideoMeta = {
      src: "blob:http://localhost/123",
      durationSec: 10,
      width: 1080,
      height: 1920,
    };

    useStudioStore.getState().loadVideo(meta);

    const after = useStudioStore.getState();
    expect(after.video).toEqual(meta);
    expect(after.lines).toEqual([]);
    expect(after.selectedLineId).toBeNull();
    expect(after.editingLineId).toBeNull();
    expect(after.past.length).toBe(1);
    expect(after.past[0].label).toBe("Load video");

    // Calling undo should restore previous state
    after.undo();
    const restored = useStudioStore.getState();
    expect(restored.video).toBeNull();
    expect(restored.lines.length).toBe(1);
  });

  it("loads a video with explicit lines (demo mode)", () => {
    const meta: VideoMeta = {
      src: "/test1.mp4",
      durationSec: 15,
      width: 1920,
      height: 1080,
      isDemo: true,
    };
    const sampleLines = [
      { id: "1", start: 0, end: 2, words: [{ id: "w1", text: "Demo", start: 0, end: 2 }] },
    ];

    useStudioStore.getState().loadVideo(meta, sampleLines);
    const state = useStudioStore.getState();
    expect(state.video).toEqual(meta);
    expect(state.lines).toEqual(sampleLines);
  });

  it("revokes previous blob URL when loading a new video", () => {
    const revokeSpy = spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    useStudioStore.setState({
      video: { src: "blob:http://localhost/old-blob", durationSec: 5, width: 1920, height: 1080 },
    });

    const newMeta: VideoMeta = {
      src: "blob:http://localhost/new-blob",
      durationSec: 10,
      width: 1080,
      height: 1920,
    };

    useStudioStore.getState().loadVideo(newMeta);
    expect(revokeSpy).toHaveBeenCalledWith("blob:http://localhost/old-blob");

    revokeSpy.mockRestore();
  });

  it("does not revoke URL when loading the exact same URL or a non-blob URL", () => {
    const revokeSpy = spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    // 1. Same blob URL
    useStudioStore.setState({
      video: { src: "blob:http://localhost/same-blob", durationSec: 5, width: 1920, height: 1080 },
    });
    useStudioStore.getState().loadVideo({
      src: "blob:http://localhost/same-blob",
      durationSec: 5,
      width: 1920,
      height: 1080,
    });
    expect(revokeSpy).not.toHaveBeenCalled();

    // 2. Static non-blob URL
    useStudioStore.setState({
      video: { src: "/test1.mp4", durationSec: 15, width: 1920, height: 1080 },
    });
    useStudioStore.getState().loadVideo({
      src: "/test2.mp4",
      durationSec: 15,
      width: 1920,
      height: 1080,
    });
    expect(revokeSpy).not.toHaveBeenCalled();

    revokeSpy.mockRestore();
  });
});
