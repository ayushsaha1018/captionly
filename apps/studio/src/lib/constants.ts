/** Composition frame rate. Subtitle timings are in seconds and Remotion's
 *  <Video> syncs by time, so this sets animation granularity and export
 *  frame rate only — it does not need to match the source file's fps. */
export const FPS = 30;

/** Fixed duration for a line created via Enter-while-editing (not the
 *  interstitial's "Add line", which fills the whole visible gap instead -
 *  see spec §3's note on addLine's two callers). Clamped to the remaining
 *  gap by the caller. */
export const DEFAULT_LINE_DURATION = 3; // seconds
