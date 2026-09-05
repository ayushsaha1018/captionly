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
});
