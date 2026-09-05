import { describe, expect, it } from "bun:test";
import { isValidVideoType } from "./videoMeta";

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
