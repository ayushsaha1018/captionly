import type { StateCreator } from "zustand";
import type { DocumentSlice, StudioState } from "./types";
import { SP1_FIXTURE } from "./fixture";

export const createDocumentSlice: StateCreator<
  StudioState,
  [],
  [],
  DocumentSlice
> = (set) => ({
  ...SP1_FIXTURE,

  setStyle: (patch) => set((s) => ({ style: { ...s.style, ...patch } })),
  setAnimation: (animation) => set({ animation }),
  setPosition: (position) => set({ position }),
  replaceDocument: (doc) => set({ ...doc }),
});
