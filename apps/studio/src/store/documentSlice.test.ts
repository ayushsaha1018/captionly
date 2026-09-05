import { describe, expect, it } from "bun:test";
import { useStudioStore } from "./index";
import type { VideoMeta } from "./types";

describe("documentSlice loadVideo", () => {
  it("initializes with null video and empty lines", () => {
    const state = useStudioStore.getState();
    expect(state.video).toBeNull();
    expect(state.lines).toEqual([]);
  });

  it("loads a video, resets lines by default, and records an undo snapshot", () => {
    const meta: VideoMeta = {
      src: "blob:http://localhost/123",
      durationSec: 10,
      width: 1080,
      height: 1920,
    };

    const initialPastCount = useStudioStore.getState().past.length;
    useStudioStore.getState().loadVideo(meta);

    const after = useStudioStore.getState();
    expect(after.video).toEqual(meta);
    expect(after.lines).toEqual([]);
    expect(after.past.length).toBe(initialPastCount + 1);
    expect(after.past[after.past.length - 1].label).toBe("Load video");
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
});
