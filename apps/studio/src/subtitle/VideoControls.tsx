import React, { useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize2,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import type { StudioPlayerState } from "./useStudioPlayer";

interface VideoControlsProps {
  player: StudioPlayerState;
}

const formatTime = (seconds: number) => {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export function VideoControls({ player }: VideoControlsProps) {
  const {
    isPlaying,
    currentTime,
    duration,
    buffered,
    volume,
    isMuted,
    playbackRate,
    play,
    pause,
    togglePlay,
    seek,
    skip,
    setVolume,
    toggleMute,
    setPlaybackRate,
    toggleFullscreen,
  } = player;

  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const [hoverPosition, setHoverPosition] = useState<{ percent: number; time: number } | null>(
    null,
  );
  const wasPlayingRef = useRef(false);

  // Time to display: during drag show dragTime, otherwise currentTime
  const activeTime = isDragging ? dragTime : currentTime;
  const currentPercent =
    duration > 0 ? Math.min(100, Math.max(0, (activeTime / duration) * 100)) : 0;
  const bufferedPercent =
    duration > 0 ? Math.min(100, Math.max(0, (buffered / duration) * 100)) : 0;

  const effectiveVolume = isMuted ? 0 : volume;

  // Calculate seek time from pointer position
  const getTimeFromPointer = useCallback(
    (clientX: number) => {
      if (!trackRef.current || duration <= 0) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const fraction = Math.max(0, Math.min(1, relativeX / rect.width));
      return fraction * duration;
    },
    [duration],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    wasPlayingRef.current = isPlaying;
    if (isPlaying) {
      pause();
    }
    const newTime = getTimeFromPointer(e.clientX);
    setDragTime(newTime);
    seek(newTime);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const newTime = getTimeFromPointer(e.clientX);
    const fraction = duration > 0 ? newTime / duration : 0;

    // Update hover tooltip
    setHoverPosition({ percent: fraction * 100, time: newTime });

    // If dragging, update seek position in real-time
    if (isDragging) {
      setDragTime(newTime);
      seek(newTime);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore release error
    }
    setIsDragging(false);
    if (wasPlayingRef.current) {
      play();
    }
  };

  const handlePointerLeave = () => {
    if (!isDragging) {
      setHoverPosition(null);
    }
  };

  const renderVolumeIcon = () => {
    if (isMuted || effectiveVolume === 0) {
      return (
        <VolumeX size={17} className="text-muted-foreground hover:text-foreground transition" />
      );
    }
    if (effectiveVolume < 0.5) {
      return (
        <Volume1 size={17} className="text-muted-foreground hover:text-foreground transition" />
      );
    }
    return <Volume2 size={17} className="text-muted-foreground hover:text-foreground transition" />;
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5 shadow-sm select-none">
      {/* Top Row: Smooth Scrubbing Seekbar with Circle Thumb & Hover Tooltip */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className="group relative flex h-6 w-full cursor-pointer items-center touch-none py-2"
        role="slider"
        aria-label="Video seekbar"
        aria-valuemin={0}
        aria-valuemax={duration || 0}
        aria-valuenow={activeTime}
      >
        {/* Hover Time Tooltip */}
        {hoverPosition && (
          <div
            className="absolute -top-7 z-30 -translate-x-1/2 rounded bg-popover px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-popover-foreground shadow-md pointer-events-none border border-border transition-opacity"
            style={{ left: `${hoverPosition.percent}%` }}
          >
            {formatTime(hoverPosition.time)}
          </div>
        )}

        {/* Track Bar Background */}
        <div className="relative h-1.5 w-full rounded-full bg-secondary transition-all duration-150 group-hover:h-2">
          {/* Buffered Progress Fill */}
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-primary/20 transition-all duration-150"
            style={{ width: `${bufferedPercent}%` }}
          />

          {/* Hover Preview Bar */}
          {hoverPosition && (
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-foreground/10 pointer-events-none"
              style={{ width: `${hoverPosition.percent}%` }}
            />
          )}

          {/* Played Progress Fill */}
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-primary"
            style={{ width: `${currentPercent}%` }}
          />
        </div>

        {/* Circular Scrubber Thumb Handle */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-primary ring-2 ring-background shadow-md transition-transform duration-75 pointer-events-none ${
            isDragging ? "h-4 w-4 scale-125" : "h-3.5 w-3.5 group-hover:scale-125 scale-100"
          }`}
          style={{ left: `${currentPercent}%` }}
        />
      </div>

      {/* Bottom Row: Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Left: Play/Pause, Skips, and Time Display */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>

          <button
            onClick={() => skip(-5)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Skip back 5 seconds (← or J)"
            title="Rewind 5s (← / J)"
          >
            <RotateCcw size={15} />
          </button>

          <button
            onClick={() => skip(5)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Skip forward 5 seconds (→ or L)"
            title="Forward 5s (→ / L)"
          >
            <RotateCw size={15} />
          </button>

          {/* Time Display */}
          <div className="ml-1 flex items-center gap-1 text-xs font-medium tabular-nums text-muted-foreground">
            <span className="text-foreground">{formatTime(activeTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Volume, Playback Speed, Fullscreen */}
        <div className="flex items-center gap-3">
          {/* Volume Control */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleMute}
              className="flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label={isMuted ? "Unmute (M)" : "Mute (M)"}
              title="Toggle Mute (M)"
            >
              {renderVolumeIcon()}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={effectiveVolume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="h-1.5 w-18 cursor-pointer accent-primary bg-secondary rounded-lg"
              aria-label="Volume"
            />
          </div>

          {/* Speed Selector */}
          <select
            value={playbackRate}
            onChange={(e) => setPlaybackRate(Number(e.target.value))}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Playback rate"
          >
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
              <option key={rate} value={rate}>
                {rate}x
              </option>
            ))}
          </select>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Toggle Fullscreen (F)"
            title="Toggle Fullscreen (F)"
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
