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
