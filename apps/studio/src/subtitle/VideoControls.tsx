import { Play, Pause, Volume2, Maximize2 } from "lucide-react";

type Props = {
  playing: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (t: number) => void;
  onVolume: (v: number) => void;
  onRate: (r: number) => void;
  onFullscreen: () => void;
};

const fmt = (s: number) => {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export function VideoControls({
  playing, currentTime, duration,
  onPlayPause, onSeek, onVolume, onRate, onFullscreen,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <button
        onClick={onPlayPause}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:scale-105"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
      </button>

      <div className="flex flex-1 items-center gap-3 min-w-[200px]">
        <span className="text-xs tabular-nums text-muted-foreground w-10">{fmt(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={currentTime}
          onChange={(e) => onSeek(+e.target.value)}
          className="flex-1 accent-[hsl(var(--primary))]"
        />
        <span className="text-xs tabular-nums text-muted-foreground w-10">{fmt(duration)}</span>
      </div>

      <div className="flex items-center gap-2">
        <Volume2 size={16} className="text-muted-foreground" />
        <input
          type="range" min={0} max={1} step={0.01} defaultValue={1}
          onChange={(e) => onVolume(+e.target.value)}
          className="w-20 accent-[hsl(var(--primary))]"
        />
      </div>

      <select
        defaultValue={1}
        onChange={(e) => onRate(+e.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
      >
        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
          <option key={r} value={r}>{r}x</option>
        ))}
      </select>

      <button
        onClick={onFullscreen}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground transition hover:bg-accent"
        aria-label="Fullscreen"
      >
        <Maximize2 size={16} />
      </button>
    </div>
  );
}
