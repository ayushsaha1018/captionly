import { test, expect, beforeEach } from "bun:test";
import { useStudioStore, COALESCE_MS, MAX_HISTORY } from "./index";
import { SP1_FIXTURE } from "./fixture";

const reset = () =>
  useStudioStore.setState({ ...SP1_FIXTURE, past: [], future: [] });

beforeEach(reset);

const s = () => useStudioStore.getState();

test("a discrete action pushes one entry and clears future", () => {
  s().commit("Set style");
  s().setStyle({ fontSize: 90 });
  expect(s().past.length).toBe(1);

  s().undo();
  expect(s().future.length).toBe(1);

  s().commit("Set style");
  expect(s().future.length).toBe(0);
});

test("two text edits to the same line within the window produce one entry", () => {
  s().commit("Edit line", { coalesceKey: "text:line-1" });
  s().commit("Edit line", { coalesceKey: "text:line-1" });
  expect(s().past.length).toBe(1);
});

test("text edits to different lines within the window produce two entries", () => {
  s().commit("Edit line", { coalesceKey: "text:line-1" });
  s().commit("Edit line", { coalesceKey: "text:line-2" });
  expect(s().past.length).toBe(2);
});

test("text edits to the same line outside the window produce two entries", async () => {
  s().commit("Edit line", { coalesceKey: "text:line-1" });
  useStudioStore.setState((st) => ({
    past: st.past.map((e) => ({ ...e, at: e.at - COALESCE_MS - 1 })),
  }));
  s().commit("Edit line", { coalesceKey: "text:line-1" });
  expect(s().past.length).toBe(2);
});

test("discrete actions never coalesce with each other", () => {
  s().commit("Delete line");
  s().commit("Delete line");
  expect(s().past.length).toBe(2);
});

test("coalescing keeps the OLDER snapshot", () => {
  useStudioStore.setState({ style: { ...s().style, fontSize: 10 } });
  s().commit("Edit line", { coalesceKey: "text:line-1" });
  useStudioStore.setState({ style: { ...s().style, fontSize: 20 } });
  s().commit("Edit line", { coalesceKey: "text:line-1" });

  expect(s().past.length).toBe(1);
  // Undo must return to before the typing burst began, not to its middle.
  expect(s().past[0].snapshot.style.fontSize).toBe(10);
});

test("past never exceeds MAX_HISTORY, dropping oldest first", () => {
  for (let i = 0; i < MAX_HISTORY + 20; i++) s().commit(`Action ${i}`);
  expect(s().past.length).toBe(MAX_HISTORY);
  expect(s().past[s().past.length - 1].label).toBe(`Action ${MAX_HISTORY + 19}`);
});

test("undo restores the document and redo reapplies it", () => {
  s().setStyle({ fontSize: 42 });
  s().commit("Set style");
  s().setStyle({ fontSize: 99 });

  s().undo();
  expect(s().style.fontSize).toBe(42);

  s().redo();
  expect(s().style.fontSize).toBe(99);
});

test("undo on empty history is a no-op", () => {
  expect(() => s().undo()).not.toThrow();
  expect(s().past.length).toBe(0);
});
