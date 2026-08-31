import { create } from "zustand";
import type { StudioState } from "./types";
import { createDocumentSlice } from "./documentSlice";
import { createEditorSlice } from "./editorSlice";
import { createHistorySlice } from "./historySlice";

export const useStudioStore = create<StudioState>()((...a) => ({
  ...createDocumentSlice(...a),
  ...createEditorSlice(...a),
  ...createHistorySlice(...a),
}));

export { MAX_HISTORY, COALESCE_MS } from "./historySlice";
export type * from "./types";
