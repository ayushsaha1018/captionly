import type { StateCreator } from "zustand";
import type { EditorSlice, StudioState } from "./types";

export const createEditorSlice: StateCreator<
  StudioState,
  [],
  [],
  EditorSlice
> = (set) => ({
  selectedLineId: null,
  editingLineId: null,
  activeTab: "lines",

  select: (selectedLineId) => set({ selectedLineId }),
  beginEdit: (id) => set({ editingLineId: id, selectedLineId: id }),
  endEdit: () => set({ editingLineId: null }),
  setTab: (activeTab) => set({ activeTab }),
});
