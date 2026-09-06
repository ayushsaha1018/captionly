import type { StateCreator } from "zustand";
import type { DocumentSnapshot, HistorySlice, StudioState } from "./types";

export const MAX_HISTORY = 100;
export const COALESCE_MS = 600;

function snapshot(s: StudioState): DocumentSnapshot {
  return {
    video: s.video,
    lines: s.lines,
    style: s.style,
    animation: s.animation,
    position: s.position,
  };
}

export const createHistorySlice: StateCreator<StudioState, [], [], HistorySlice> = (set, get) => ({
  past: [],
  future: [],

  commit: (label, opts) => {
    const state = get();
    const entry = {
      snapshot: snapshot(state),
      label,
      coalesceKey: opts?.coalesceKey,
      at: Date.now(),
    };

    const top = state.past[state.past.length - 1];
    const coalesces =
      entry.coalesceKey !== undefined &&
      top?.coalesceKey === entry.coalesceKey &&
      entry.at - top.at < COALESCE_MS;

    if (coalesces) {
      // Keep the OLDER snapshot; refresh only the timestamp so a continuous
      // burst of typing keeps extending the same window.
      const past = state.past.slice(0, -1);
      past.push({ ...top, at: entry.at });
      set({ past, future: [] });
      return;
    }

    const past = [...state.past, entry];
    if (past.length > MAX_HISTORY) past.splice(0, past.length - MAX_HISTORY);
    set({ past, future: [] });
  },

  undo: () => {
    const state = get();
    const top = state.past[state.past.length - 1];
    if (!top) return;
    set({
      past: state.past.slice(0, -1),
      future: [...state.future, { snapshot: snapshot(state), label: top.label, at: Date.now() }],
    });
    state.replaceDocument(top.snapshot);
  },

  redo: () => {
    const state = get();
    const top = state.future[state.future.length - 1];
    if (!top) return;
    set({
      future: state.future.slice(0, -1),
      past: [...state.past, { snapshot: snapshot(state), label: top.label, at: Date.now() }],
    });
    state.replaceDocument(top.snapshot);
  },
});
