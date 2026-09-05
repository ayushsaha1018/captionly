import type { StateCreator } from "zustand";
import type { SubtitleLine } from "@captionly/engine";
import { defaultStyle, defaultPosition, defaultAnimation } from "@captionly/engine";
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
});
