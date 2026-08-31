import type { PlayerRef } from "@remotion/player";
import type { SubtitleLine } from "@captionly/engine";
import { useCurrentPlayerFrame } from "@/lib/useCurrentPlayerFrame";
import { useStudioStore } from "@/store";
import { FPS } from "@/lib/constants";

/**
 * The playhead renders INSIDE the active row and positions itself as a
 * percentage of that row's own height.
 *
 * It deliberately does NOT compute an absolute offset by re-walking
 * lineHeight()/voidHeight(). LineRow sets `minHeight`, so a row whose content
 * exceeds the 72px floor — any selected short line, once the word strip
 * appears — is taller than geometry predicts, and every subsequent offset
 * drifts. Positioning within the row is correct by construction.
 *
 * This re-renders at fps by design, which is why it renders one element and
 * nothing else. No store writes here, and never call useCurrentPlayerFrame
 * anywhere but a leaf like this one.
 */
export function Playhead({
  playerRef,
  line,
}: {
  playerRef: React.RefObject<PlayerRef | null>;
  line: SubtitleLine;
}) {
  const frame = useCurrentPlayerFrame(playerRef);
  const span = line.end - line.start;
  if (span <= 0) return null;

  const progress = Math.min(1, Math.max(0, (frame / FPS - line.start) / span));

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 right-0 z-10 h-px bg-now"
      style={{ top: `${progress * 100}%` }}
    />
  );
}

/** Returns the id of the line under the playhead, or null. Leaf-only. */
export function useActiveLineId(playerRef: React.RefObject<PlayerRef | null>): string | null {
  const frame = useCurrentPlayerFrame(playerRef);
  const lines = useStudioStore((s) => s.lines);
  const t = frame / FPS;
  return lines.find((l) => t >= l.start && t <= l.end)?.id ?? null;
}
