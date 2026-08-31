/** Formats seconds as M:SS.cc, extending to H:MM:SS.cc past one hour. */
export function formatTimecode(seconds: number): string {
  const total = Math.max(0, Math.round(seconds * 100)); // centiseconds
  const cc = total % 100;
  const totalSec = (total - cc) / 100;
  const ss = totalSec % 60;
  const totalMin = (totalSec - ss) / 60;
  const mm = totalMin % 60;
  const hh = (totalMin - mm) / 60;

  const p = (n: number) => String(n).padStart(2, "0");
  return hh > 0 ? `${hh}:${p(mm)}:${p(ss)}.${p(cc)}` : `${mm}:${p(ss)}.${p(cc)}`;
}

/** Parses M:SS.cc or H:MM:SS.cc. Returns null when the input is not a timecode. */
export function parseTimecode(input: string): number | null {
  const m = input.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const [, h, a, b, cs] = m;
  const hours = h ? Number(h) : 0;
  const mins = Number(a);
  const secs = Number(b);
  if (secs > 59 || (h && mins > 59)) return null;
  const centis = cs ? Number(cs.padEnd(2, "0")) : 0;
  return hours * 3600 + mins * 60 + secs + centis / 100;
}
