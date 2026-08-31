import type { PlayerRef } from "@remotion/player";
import { Play, Pause } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useStudioStore } from "@/store";
import { StudioPlayer } from "@/subtitle/StudioPlayer";
import { formatTimecode } from "@/lib/timecode";
import { FPS } from "@/lib/constants";
import type { SafeZonePreset } from "@captionly/engine";

export function PlayerRail({
  playerRef,
  safeZone,
  onSafeZoneChange,
}: {
  playerRef: React.RefObject<PlayerRef | null>;
  safeZone: SafeZonePreset;
  onSafeZoneChange: (z: SafeZonePreset) => void;
}) {
  const { video, lines, style, animation, position } = useStudioStore(
    useShallow((s) => ({
      video: s.video,
      lines: s.lines,
      style: s.style,
      animation: s.animation,
      position: s.position,
    })),
  );
  const [playing, setPlaying] = useState(false);

  // Track play state from the player's own events. Do NOT derive it by calling
  // isPlaying() right after play()/pause() — the call races the state change.
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    setPlaying(p.isPlaying());
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    return () => {
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
    };
  }, [playerRef]);

  const toggle = useCallback(() => playerRef.current?.toggle(), [playerRef]);

  // Guard on null now, so sub-project 2 can drop the fixture without
  // reintroducing durationInFrames={0}.
  if (!video) {
    return (
      <aside className="flex items-center justify-center rounded-xl border border-hairline bg-surface p-8">
        <p className="font-display text-sm text-ink-muted">No video loaded.</p>
      </aside>
    );
  }

  const aspect = video.width / video.height;

  return (
    <aside
      className="flex flex-col gap-4 self-start sticky top-6"
      style={{ width: `clamp(280px, ${aspect >= 1 ? "42vw" : "24vw"}, 640px)` }}
    >
      <div style={{ aspectRatio: String(aspect) }}>
        <StudioPlayer
          videoSrc={video.src}
          subtitles={{ lines, style, position, animation }}
          safeZone={safeZone}
          durationInFrames={Math.round(video.durationSec * FPS)}
          compositionWidth={video.width}
          compositionHeight={video.height}
          fps={FPS}
          playerRef={playerRef}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="grid h-9 w-9 place-items-center rounded-full bg-edit text-void
                     transition-transform hover:scale-105 active:scale-95
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <span className="tabular text-xs text-ink-muted">{formatTimecode(video.durationSec)}</span>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-ink-muted">
          Safe zone
        </span>
        <select
          value={safeZone}
          onChange={(e) => onSafeZoneChange(e.target.value as SafeZonePreset)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
        >
          <option value="none">None</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
          <option value="youtube">YouTube</option>
        </select>
      </label>
    </aside>
  );
}
