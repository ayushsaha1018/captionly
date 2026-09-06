import type { StateCreator } from "zustand";
import type { SubtitleLine, Word } from "@captionly/engine";
import {
  defaultStyle,
  defaultPosition,
  defaultAnimation,
  computeWordTimings,
} from "@captionly/engine";
import type { DocumentSlice, StudioState, VideoMeta } from "./types";

/** Returns how many of `words` go in the first half after splitting at the
 *  boundary nearest `caretIndex` (an offset into words.map(w=>w.text).join(" ")).
 *  Returns -1 if there are fewer than two words (no boundary exists). */
function findNearestWordBoundary(words: Word[], caretIndex: number): number {
  if (words.length < 2) return -1;

  let offset = 0;
  const boundaries: number[] = [];
  for (const w of words) {
    offset += w.text.length;
    boundaries.push(offset); // offset right after this word's text
    offset += 1; // the joining space
  }

  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < words.length - 1; i++) {
    const dist = Math.abs(boundaries[i] - caretIndex);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best + 1;
}

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

  setLines: (lines) => {
    set({
      lines,
      selectedLineId: lines[0]?.id ?? null,
      editingLineId: null,
    });
  },

  setStyle: (patch) => set((s) => ({ style: { ...s.style, ...patch } })),
  setAnimation: (animation) => set({ animation }),
  setPosition: (position) => set({ position }),
  // undo/redo restore a snapshot that may not contain the line the selection /
  // edit cursor points at (e.g. undoing an addLine). A dangling editingLineId
  // silently disables keyboard-delete and playhead-follow, so drop both if they
  // no longer resolve.
  replaceDocument: (doc) => {
    const { selectedLineId, editingLineId } = get();
    const ids = new Set(doc.lines.map((l) => l.id));
    set({
      ...doc,
      selectedLineId: selectedLineId && ids.has(selectedLineId) ? selectedLineId : null,
      editingLineId: editingLineId && ids.has(editingLineId) ? editingLineId : null,
    });
  },

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
    const max = line.end - 0.01;
    // Degenerate: the line is already too short for the self-bound and the
    // neighbour bound to both hold. Reject rather than silently overlap prev.
    if (min > max) return;
    const start = Math.min(Math.max(seconds, min), max);

    state.commit("Retime line", { coalesceKey: `retime:${id}:in` });
    const text = line.words.map((w) => w.text).join(" ");
    const updated: SubtitleLine = {
      ...line,
      start,
      words: computeWordTimings(text, start, line.end),
    };
    set({ lines: state.lines.map((l) => (l.id === id ? updated : l)) });
  },

  setLineOut: (id, seconds) => {
    const state = get();
    const idx = state.lines.findIndex((l) => l.id === id);
    if (idx === -1) return;
    const line = state.lines[idx];
    const next = state.lines[idx + 1];
    const min = line.start + 0.01;
    const max = next ? next.start : (state.video?.durationSec ?? Infinity);
    // Degenerate: see setLineIn.
    if (min > max) return;
    const end = Math.max(Math.min(seconds, max), min);

    state.commit("Retime line", { coalesceKey: `retime:${id}:out` });
    const text = line.words.map((w) => w.text).join(" ");
    const updated: SubtitleLine = {
      ...line,
      end,
      words: computeWordTimings(text, line.start, end),
    };
    set({ lines: state.lines.map((l) => (l.id === id ? updated : l)) });
  },

  deleteLine: (id) => {
    const state = get();
    state.commit("Delete line");
    set({ lines: state.lines.filter((l) => l.id !== id) });
    if (state.selectedLineId === id) get().select(null);
    if (state.editingLineId === id) get().endEdit();
  },

  mergeLines: (aId, bId) => {
    const state = get();
    const a = state.lines.find((l) => l.id === aId);
    const b = state.lines.find((l) => l.id === bId);
    if (!a || !b) return;

    state.commit("Merge lines");

    const text = [...a.words, ...b.words].map((w) => w.text).join(" ");
    const merged: SubtitleLine = {
      id: a.id,
      start: a.start,
      end: b.end,
      words: computeWordTimings(text, a.start, b.end),
    };

    const lines = state.lines.filter((l) => l.id !== bId).map((l) => (l.id === aId ? merged : l));
    set({ lines });
    // b no longer exists - retarget dangling selection/editing to the merged
    // survivor (a), mirroring deleteLine's clear-on-removal handling.
    if (state.selectedLineId === bId) get().select(aId);
    if (state.editingLineId === bId) get().beginEdit(aId);
  },

  splitLine: (id, caretIndex) => {
    const state = get();
    const idx = state.lines.findIndex((l) => l.id === id);
    if (idx === -1) return;
    const line = state.lines[idx];

    const text = line.words.map((w) => w.text).join(" ");
    if (caretIndex <= 0 || caretIndex >= text.length) return;

    const splitAt = findNearestWordBoundary(line.words, caretIndex);
    if (splitAt < 1) return;

    const firstWords = line.words.slice(0, splitAt);
    const secondWords = line.words.slice(splitAt);
    const splitTime = firstWords[firstWords.length - 1].end;

    state.commit("Split line");

    const firstLine: SubtitleLine = {
      ...line,
      end: splitTime,
      words: computeWordTimings(firstWords.map((w) => w.text).join(" "), line.start, splitTime),
    };
    const secondLine: SubtitleLine = {
      id: crypto.randomUUID(),
      start: splitTime,
      end: line.end,
      words: computeWordTimings(secondWords.map((w) => w.text).join(" "), splitTime, line.end),
    };

    const lines = [...state.lines];
    lines.splice(idx, 1, firstLine, secondLine);
    set({ lines });
  },
});
