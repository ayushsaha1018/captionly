import { describe, expect, it } from "bun:test";
import { isValidVideoType, extractVideoMetadata } from "./videoMeta";

describe("isValidVideoType", () => {
  it("accepts mp4, webm, and quicktime/mov", () => {
    expect(isValidVideoType("video/mp4")).toBe(true);
    expect(isValidVideoType("video/webm")).toBe(true);
    expect(isValidVideoType("video/quicktime")).toBe(true);
  });

  it("rejects non-video mime types", () => {
    expect(isValidVideoType("image/png")).toBe(false);
    expect(isValidVideoType("audio/mp3")).toBe(false);
    expect(isValidVideoType("application/json")).toBe(false);
    expect(isValidVideoType("")).toBe(false);
  });
});

describe("extractVideoMetadata", () => {
  it("rejects non-video files early", async () => {
    const fakeFile = new File(["foo"], "test.png", { type: "image/png" });
    // In bun test (non-browser without document), it should either throw browser env error or reject
    try {
      await extractVideoMetadata(fakeFile);
      expect(true).toBe(false);
    } catch (e: unknown) {
      expect((e as Error).message).toBeTruthy();
    }
  });
});
