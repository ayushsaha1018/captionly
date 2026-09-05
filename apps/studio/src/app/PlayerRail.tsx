import type { PlayerRef } from "@remotion/player";
import { Upload, Film, Loader2, RefreshCw, AlertCircle, Play, Pause } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useStudioStore } from "@/store";
import { StudioPlayer } from "@/subtitle/StudioPlayer";
import { formatTimecode } from "@/lib/timecode";
import { FPS } from "@/lib/constants";
import type { SafeZonePreset } from "@captionly/engine";
import { sampleSubtitles } from "@captionly/engine";
import { extractVideoMetadata } from "@/lib/videoMeta";
import { SAFE_ZONES } from "@/subtitle/SafeZones";

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
  const loadVideo = useStudioStore((s) => s.loadVideo);

  const [playing, setPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const meta = await extractVideoMetadata(file);
      loadVideo(meta);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load video");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleLoadDemo = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const meta = await extractVideoMetadata("/test1.mp4");
      loadVideo(meta, sampleSubtitles);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load demo video");
    } finally {
      setIsLoading(false);
    }
  };

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

  if (!video) {
    return (
      <aside className="flex w-full max-w-[480px] shrink-0 flex-col gap-4 self-start">
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
        />

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) {
              handleFile(file);
            }
          }}
          onClick={() => {
            if (!isLoading) {
              fileInputRef.current?.click();
            }
          }}
          className={`flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            isDragging
              ? "border-edit bg-edit/10"
              : "border-hairline bg-surface hover:border-edit/50 hover:bg-surface/80"
          }`}
        >
          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-edit" />
              <p className="font-display text-sm font-medium text-ink">Reading video metadata...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="relative grid h-12 w-12 place-items-center rounded-full bg-raised text-ink-muted">
                <Film className="h-6 w-6" />
                <Upload className="absolute -bottom-1 -right-1 h-3.5 w-3.5 text-edit" />
              </div>
              <div>
                <p className="font-display text-sm font-medium text-ink">
                  Drop video file or click to browse
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">MP4, WebM, MOV</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLoadDemo();
                }}
                className="mt-1 rounded-md border border-hairline bg-raised px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-edit hover:bg-raised/80 hover:text-edit"
              >
                or Load Demo Video
              </button>
            </div>
          )}
        </div>
      </aside>
    );
  }

  const aspect = video.width / video.height;
  const targetCategory = video.width < video.height ? "9:16" : "16:9";
  const recommendedEntries = Object.entries(SAFE_ZONES).filter(
    ([, m]) => m.category === targetCategory,
  );
  const otherEntries = Object.entries(SAFE_ZONES).filter(([, m]) => m.category !== targetCategory);

  return (
    // `sticky` is gone: the page no longer scrolls, so the rail is already
    // fixed. It scrolls itself only if the viewport is too short for it.
    <aside
      className="flex max-h-full shrink-0 flex-col gap-4 self-start overflow-y-auto"
      style={{ width: `clamp(280px, ${aspect >= 1 ? "42vw" : "24vw"}, 640px)` }}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
      />

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

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

      <div className="flex items-center justify-between gap-3">
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
          <span className="tabular text-xs text-ink-muted">
            {formatTimecode(video.durationSec)}
          </span>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Replace video</span>
        </button>
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
          <optgroup label={`Recommended (${targetCategory})`}>
            {recommendedEntries.map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Other formats">
            {otherEntries.map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
    </aside>
  );
}
