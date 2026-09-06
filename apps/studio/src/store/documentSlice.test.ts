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

describe("setLineIn / setLineOut", () => {
  beforeEach(() => {
    useStudioStore.setState({
      video: { src: "/test.mp4", durationSec: 10, width: 1920, height: 1080 },
      lines: [
        { id: "a", start: 0, end: 2, words: [] },
        { id: "b", start: 2, end: 4, words: [] },
      ],
      past: [],
      future: [],
    });
  });

  it("setLineIn clamps to the previous line's end", () => {
    useStudioStore.getState().setLineIn("b", 1); // before "a" ends at 2
    expect(useStudioStore.getState().lines[1].start).toBe(2);
  });

  it("setLineIn clamps below its own end", () => {
    useStudioStore.getState().setLineIn("b", 4.5); // past its own end at 4
    const line = useStudioStore.getState().lines[1];
    expect(line.start).toBeLessThan(line.end);
  });

  it("setLineOut clamps to the next line's start", () => {
    useStudioStore.getState().setLineOut("a", 3); // past "b" starting at 2
    expect(useStudioStore.getState().lines[0].end).toBe(2);
  });

  it("setLineOut clamps to video duration for the last line", () => {
    useStudioStore.getState().setLineOut("b", 999);
    expect(useStudioStore.getState().lines[1].end).toBe(10);
  });

  it("recomputes words to fill the new span", () => {
    useStudioStore.getState().editLineText("a", "hi");
    useStudioStore.getState().setLineOut("a", 1);
    const line = useStudioStore.getState().lines[0];
    expect(line.words.at(-1)!.end).toBe(1);
  });

  it("setLineIn no-ops when the line is too short for the range to be valid", () => {
    // b spans [2, 2.005]: prev.end (2) > b.end - 0.01 (1.995). No valid start.
    useStudioStore.setState({
      lines: [
        { id: "a", start: 0, end: 2, words: [] },
        { id: "b", start: 2, end: 2.005, words: [] },
      ],
      past: [],
    });
    useStudioStore.getState().setLineIn("b", 1);
    const state = useStudioStore.getState();
    expect(state.lines[1].start).toBe(2);
    expect(state.lines[1].end).toBe(2.005);
    expect(state.past.length).toBe(0);
  });

  it("setLineOut no-ops when the line is too short for the range to be valid", () => {
    // a spans [0, 0.005]: a.start + 0.01 (0.01) > next.start (0.005). No valid end.
    useStudioStore.setState({
      lines: [
        { id: "a", start: 0, end: 0.005, words: [] },
        { id: "b", start: 0.005, end: 2, words: [] },
      ],
      past: [],
    });
    useStudioStore.getState().setLineOut("a", 1);
    const state = useStudioStore.getState();
    expect(state.lines[0].end).toBe(0.005);
    expect(state.past.length).toBe(0);
  });

  it("coalesces rapid retimes to the same line and field, not across fields", () => {
    useStudioStore.getState().setLineOut("a", 1.5);
    useStudioStore.getState().setLineOut("a", 1.8);
    expect(useStudioStore.getState().past.length).toBe(1);

    useStudioStore.getState().setLineIn("a", 0.1);
    expect(useStudioStore.getState().past.length).toBe(2);
  });
});

describe("deleteLine", () => {
  beforeEach(() => {
    useStudioStore.setState({
      video: { src: "/test.mp4", durationSec: 10, width: 1920, height: 1080 },
      lines: [
        { id: "a", start: 0, end: 2, words: [] },
        { id: "b", start: 2, end: 4, words: [] },
      ],
      past: [],
      future: [],
      selectedLineId: "b",
      editingLineId: "b",
    });
  });

  it("removes the line and clears selection/editing if it was selected", () => {
    useStudioStore.getState().deleteLine("b");
    const state = useStudioStore.getState();
    expect(state.lines).toHaveLength(1);
    expect(state.lines[0].id).toBe("a");
    expect(state.selectedLineId).toBeNull();
    expect(state.editingLineId).toBeNull();
  });

  it("leaves selection alone when deleting a different line", () => {
    useStudioStore.getState().deleteLine("a");
    expect(useStudioStore.getState().selectedLineId).toBe("b");
  });

  it("records undo", () => {
    useStudioStore.getState().deleteLine("b");
    expect(useStudioStore.getState().past[0].label).toBe("Delete line");
    useStudioStore.getState().undo();
    expect(useStudioStore.getState().lines).toHaveLength(2);
  });
});

describe("mergeLines", () => {
  beforeEach(() => {
    useStudioStore.setState({
      video: { src: "/test.mp4", durationSec: 10, width: 1920, height: 1080 },
      lines: [
        {
          id: "a",
          start: 0,
          end: 2,
          words: [{ id: "w1", text: "hello", start: 0, end: 2 }],
        },
        {
          id: "b",
          start: 3,
          end: 5, // note the gap 2 -> 3, which merge must swallow
          words: [{ id: "w2", text: "world", start: 3, end: 5 }],
        },
      ],
      past: [],
      future: [],
    });
  });

  it("concatenates text and spans [a.start, b.end], swallowing the gap", () => {
    useStudioStore.getState().mergeLines("a", "b");
    const state = useStudioStore.getState();
    expect(state.lines).toHaveLength(1);
    expect(state.lines[0].id).toBe("a");
    expect(state.lines[0].start).toBe(0);
    expect(state.lines[0].end).toBe(5);
    expect(state.lines[0].words.map((w) => w.text)).toEqual(["hello", "world"]);
    // The gap must be swallowed inside the recomputed WORD timings too, not just
    // the line's start/end fields - a naive implementation that recomputes each
    // original line's words over its own sub-range (instead of one call over the
    // full merged span) would pass every assertion above while still leaving a
    // 1s hole between the words themselves ("hello" ending at 2, "world"
    // starting at 3). Contiguity is the guarantee computeWordTimings makes.
    expect(state.lines[0].words[0].end).toBe(state.lines[0].words[1].start);
  });

  it("retargets selection/editing to the merged line if either pointed at the removed line", () => {
    useStudioStore.setState({ selectedLineId: "b", editingLineId: "b" });
    useStudioStore.getState().mergeLines("a", "b");
    const state = useStudioStore.getState();
    expect(state.selectedLineId).toBe("a");
    expect(state.editingLineId).toBe("a");
  });

  it("leaves selection/editing alone if neither pointed at the removed line", () => {
    useStudioStore.setState({ selectedLineId: "a", editingLineId: null });
    useStudioStore.getState().mergeLines("a", "b");
    const state = useStudioStore.getState();
    expect(state.selectedLineId).toBe("a");
    expect(state.editingLineId).toBeNull();
  });

  it("records undo under the 'Merge lines' label and restores both lines", () => {
    useStudioStore.getState().mergeLines("a", "b");
    expect(useStudioStore.getState().past[0].label).toBe("Merge lines");
    useStudioStore.getState().undo();
    expect(useStudioStore.getState().lines).toHaveLength(2);
  });
});

describe("replaceDocument via undo/redo", () => {
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

  it("clears selection/editing that point at a line the restored snapshot lacks", () => {
    useStudioStore.getState().addLine("a", 2, 4); // beginEdit()s the new line
    expect(useStudioStore.getState().editingLineId).not.toBeNull();

    useStudioStore.getState().undo(); // the new line is gone from the snapshot
    const state = useStudioStore.getState();
    expect(state.lines).toHaveLength(1);
    expect(state.selectedLineId).toBeNull();
    expect(state.editingLineId).toBeNull();
  });

  it("keeps selection/editing that still resolve in the restored snapshot", () => {
    useStudioStore.setState({ selectedLineId: "a", editingLineId: "a" });
    useStudioStore.getState().setLineOut("a", 1.5);
    useStudioStore.getState().undo();
    const state = useStudioStore.getState();
    expect(state.selectedLineId).toBe("a");
    expect(state.editingLineId).toBe("a");
  });
});

describe("splitLine", () => {
  beforeEach(() => {
    useStudioStore.setState({
      video: { src: "/test.mp4", durationSec: 10, width: 1920, height: 1080 },
      lines: [
        {
          id: "a",
          start: 0,
          end: 4,
          // joined text: "hello there friend" (offsets: h=0, t=6, f=12)
          words: [
            { id: "w1", text: "hello", start: 0, end: 1 },
            { id: "w2", text: "there", start: 1, end: 2 },
            { id: "w3", text: "friend", start: 2, end: 4 },
          ],
        },
      ],
      past: [],
      future: [],
    });
  });

  it("splits at the nearest word boundary to the caret", () => {
    // caret at index 7 ("hello t|here friend") is nearest the boundary
    // after "hello" (index 5) vs after "there" (index 11) - nearest is 5.
    useStudioStore.getState().splitLine("a", 7);
    const state = useStudioStore.getState();
    expect(state.lines).toHaveLength(2);
    expect(state.lines[0].id).toBe("a");
    expect(state.lines[0].words.map((w) => w.text)).toEqual(["hello"]);
    expect(state.lines[1].words.map((w) => w.text)).toEqual(["there", "friend"]);
    // Contiguous, AND at the boundary-finder's chosen word edge (w1.end = 1),
    // not just at whatever value the two halves happen to share.
    expect(state.lines[0].end).toBe(1);
    expect(state.lines[0].end).toBe(state.lines[1].start);
    expect(state.lines[0].start).toBe(0);
    expect(state.lines[1].end).toBe(4);
  });

  it("no-ops when the caret is at the very start of the text", () => {
    useStudioStore.getState().splitLine("a", 0);
    expect(useStudioStore.getState().lines).toHaveLength(1);
  });

  it("no-ops when the caret is at the very end of the text", () => {
    const text = "hello there friend";
    useStudioStore.getState().splitLine("a", text.length);
    expect(useStudioStore.getState().lines).toHaveLength(1);
  });

  it("no-ops on a single-word line", () => {
    useStudioStore.setState({
      lines: [{ id: "a", start: 0, end: 2, words: [{ id: "w1", text: "hi", start: 0, end: 2 }] }],
    });
    useStudioStore.getState().splitLine("a", 1);
    expect(useStudioStore.getState().lines).toHaveLength(1);
  });

  it("records undo under the 'Split line' label", () => {
    useStudioStore.getState().splitLine("a", 7);
    expect(useStudioStore.getState().past[0].label).toBe("Split line");
  });
});

describe("documentSlice setLines", () => {
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

  it("updates lines, selects first line, and does NOT record an undo snapshot", () => {
    const newLines = [
      { id: "l1", start: 0, end: 2, words: [{ id: "w1", text: "Hello", start: 0, end: 2 }] },
      { id: "l2", start: 2, end: 4, words: [{ id: "w2", text: "World", start: 2, end: 4 }] },
    ];

    useStudioStore.getState().setLines(newLines);

    const state = useStudioStore.getState();
    expect(state.lines).toEqual(newLines);
    expect(state.selectedLineId).toBe("l1");
    expect(state.editingLineId).toBeNull();
    // No undo entry recorded
    expect(state.past).toHaveLength(0);
  });

  it("handles empty lines array gracefully", () => {
    useStudioStore.getState().setLines([]);
    const state = useStudioStore.getState();
    expect(state.lines).toEqual([]);
    expect(state.selectedLineId).toBeNull();
    expect(state.past).toHaveLength(0);
  });
});
