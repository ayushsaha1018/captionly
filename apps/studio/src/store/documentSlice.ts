import type { StateCreator } from "zustand";
import type { SubtitleLine } from "@captionly/engine";
import { defaultStyle, defaultPosition, defaultAnimation, computeWordTimings } from "@captionly/engine";
import type { DocumentSlice, StudioState, VideoMeta } from "./types";

export const createDocumentSlice: StateCreator<StudioState, [], [], DocumentSlice> = (
  set,
  get,
) => ({
  video: null,
  lines: [],
  style: defaultStyle,
  animation: defaultAnimation,
  position: defaultPosition,

  loadVideo: (meta: VideoMeta, lines?: SubtitleLine[]) => {
    const current = get();
    // Revoke old blob URL to prevent browser memory leak (guard against self-revocation)
    if (current.video?.src.startsWith("blob:") && current.video.src !== meta.src) {
      try {
        URL.revokeObjectURL(current.video.src);
      } catch {
        // Safe ignore
      }
    }

    current.commit("Load video");
    set({
      video: meta,
      lines: lines ?? [],
      selectedLineId: null,
      editingLineId: null,
    });
  },

  setStyle: (patch) => set((s) => ({ style: { ...s.style, ...patch } })),
  setAnimation: (animation) => set({ animation }),
  setPosition: (position) => set({ position }),
  replaceDocument: (doc) => set({ ...doc }),

  addLine: (afterLineId, startAt, endAt) => {
    const state = get();
    state.commit("Add line");

    const newLine: SubtitleLine = {
      id: crypto.randomUUID(),
      start: startAt,
      end: endAt,
      words: [],
    };
    const idx = afterLineId ? state.lines.findIndex((l) => l.id === afterLineId) + 1 : 0;
    const lines = [...state.lines.slice(0, idx), newLine, ...state.lines.slice(idx)];

    set({ lines });
    get().beginEdit(newLine.id);
  },

  editLineText: (id, text) => {
    const state = get();
    const line = state.lines.find((l) => l.id === id);
    if (!line) return;

    state.commit("Edit line", { coalesceKey: `text:${id}` });
    const words = computeWordTimings(text, line.start, line.end);
    set({ lines: state.lines.map((l) => (l.id === id ? { ...l, words } : l)) });
  },

  setLineIn: (id, seconds) => {
    const state = get();
    const idx = state.lines.findIndex((l) => l.id === id);
    if (idx === -1) return;
    const line = state.lines[idx];
    const prev = state.lines[idx - 1];
    const min = prev ? prev.end : 0;
    const start = Math.min(Math.max(seconds, min), line.end - 0.01);

    state.commit("Retime line", { coalesceKey: `retime:${id}:in` });
    const text = line.words.map((w) => w.text).join(" ");
    const updated: SubtitleLine = { ...line, start, words: computeWordTimings(text, start, line.end) };
    set({ lines: state.lines.map((l) => (l.id === id ? updated : l)) });
  },

  setLineOut: (id, seconds) => {
    const state = get();
    const idx = state.lines.findIndex((l) => l.id === id);
    if (idx === -1) return;
    const line = state.lines[idx];
    const next = state.lines[idx + 1];
    const max = next ? next.start : (state.video?.durationSec ?? Infinity);
    const end = Math.max(Math.min(seconds, max), line.start + 0.01);

    state.commit("Retime line", { coalesceKey: `retime:${id}:out` });
    const text = line.words.map((w) => w.text).join(" ");
    const updated: SubtitleLine = { ...line, end, words: computeWordTimings(text, line.start, end) };
    set({ lines: state.lines.map((l) => (l.id === id ? updated : l)) });
  },

  deleteLine: (id) => {
    const state = get();
    state.commit("Delete line");
    set({ lines: state.lines.filter((l) => l.id !== id) });
    if (state.selectedLineId === id) get().select(null);
    if (state.editingLineId === id) get().endEdit();
  },
});
