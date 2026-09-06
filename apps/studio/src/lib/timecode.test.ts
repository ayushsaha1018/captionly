import { test, expect } from "bun:test";
import { formatTimecode, parseTimecode } from "./timecode";

test("formats seconds as M:SS.cc", () => {
  expect(formatTimecode(0)).toBe("0:00.00");
  expect(formatTimecode(8.4)).toBe("0:08.40");
  expect(formatTimecode(65.25)).toBe("1:05.25");
});

test("rounds centiseconds without leaking into the seconds field", () => {
  // 9.999 must not render as "0:9.100"
  expect(formatTimecode(9.999)).toBe("0:10.00");
  expect(formatTimecode(59.999)).toBe("1:00.00");
});

test("extends to H:MM:SS.cc past one hour", () => {
  expect(formatTimecode(3600)).toBe("1:00:00.00");
  expect(formatTimecode(3661.5)).toBe("1:01:01.50");
});

test("clamps negatives to zero", () => {
  expect(formatTimecode(-1)).toBe("0:00.00");
});

test("parses what it formats", () => {
  for (const s of [0, 8.4, 65.25, 3661.5]) {
    expect(parseTimecode(formatTimecode(s))).toBeCloseTo(s, 2);
  }
});

test("rejects malformed input", () => {
  expect(parseTimecode("")).toBeNull();
  expect(parseTimecode("abc")).toBeNull();
  expect(parseTimecode("1:2:3:4.00")).toBeNull();
});

test("minutes-only input is a total minute count; explicit hours bound minutes to 59", () => {
  // Lenient without an hour field — "99:05" means 99 minutes, 5 seconds.
  expect(parseTimecode("99:05")).toBe(5945);
  expect(parseTimecode("65:00")).toBe(3900);
  // Strict with one — 99 minutes alongside an explicit hour is malformed.
  expect(parseTimecode("1:99:05")).toBeNull();
});
