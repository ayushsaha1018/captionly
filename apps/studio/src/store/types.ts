import type {
  SubtitleLine,
  SubtitleStyle,
  SubtitlePosition,
  AnimationConfig,
} from "@captionly/engine";

export interface VideoMeta {
  src: string;
  durationSec: number;
  width: number;
  height: number;
  file?: File;
  isDemo?: boolean;
}

/** The serializable document. Undo snapshots this and only this. */
export interface DocumentSnapshot {
  video: VideoMeta | null;
  lines: SubtitleLine[];
  style: SubtitleStyle;
  animation: AnimationConfig;
  position: SubtitlePosition;
}

export interface DocumentSlice extends DocumentSnapshot {
  loadVideo: (meta: VideoMeta, lines?: SubtitleLine[]) => void;
  setStyle: (patch: Partial<SubtitleStyle>) => void;
  setAnimation: (a: AnimationConfig) => void;
  setPosition: (p: SubtitlePosition) => void;
  /** Used by history to restore. Does not itself record history. */
  replaceDocument: (doc: DocumentSnapshot) => void;
}

export type WorkTab = "lines" | "style";

export interface EditorSlice {
  selectedLineId: string | null;
  editingLineId: string | null;
  activeTab: WorkTab;
  select: (id: string | null) => void;
  beginEdit: (id: string) => void;
  endEdit: () => void;
  setTab: (t: WorkTab) => void;
}

export interface HistoryEntry {
  snapshot: DocumentSnapshot;
  label: string;
  /** e.g. `text:${lineId}`. Absent for discrete actions, which never coalesce. */
  coalesceKey?: string;
  at: number;
}

export interface HistorySlice {
  past: HistoryEntry[];
  future: HistoryEntry[];
  commit: (label: string, opts?: { coalesceKey?: string }) => void;
  undo: () => void;
  redo: () => void;
}

export type StudioState = DocumentSlice & EditorSlice & HistorySlice;
