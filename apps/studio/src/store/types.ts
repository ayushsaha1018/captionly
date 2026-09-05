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

/** The in-memory document state. Undo snapshots this and only this. Note: VideoMeta.file is held in memory for export and is not JSON-serializable. */
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
  /** Inserts a new empty line spanning [startAt, endAt] after `afterLineId`
   *  (null = insert at the very start) and begins editing it immediately. */
  addLine: (afterLineId: string | null, startAt: number, endAt: number) => void;
  /** Recomputes the line's words from `text` via computeWordTimings. */
  editLineText: (id: string, text: string) => void;
  setLineIn: (id: string, seconds: number) => void;
  setLineOut: (id: string, seconds: number) => void;
  deleteLine: (id: string) => void;
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
