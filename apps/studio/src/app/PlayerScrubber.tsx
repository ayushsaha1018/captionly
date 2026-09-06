import React, { useRef, useState, useCallback } from "react";
import type { PlayerRef } from "@remotion/player";
import { useCurrentPlayerFrame } from "@/lib/useCurrentPlayerFrame";
import { formatTimecode } from "@/lib/timecode";
import { FPS } from "@/lib/constants";

interface PlayerScrubberProps {
  playerRef: React.RefObject<PlayerRef | null>;
  durationSec: number;
}

/**
 * Leaf component that subscribes to the player's frame updates at 30 fps
 * to render a scrub bar and elapsed timecode without re-rendering the parent rail.
 */
export function PlayerScrubber({ playerRef, durationSec }: PlayerScrubberProps) {
  const frame = useCurrentPlayerFrame(playerRef);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const totalFrames = Math.max(1, Math.round(durationSec * FPS));
  const currentFrame = Math.min(totalFrames, Math.max(0, frame));
  const progressPercent = (currentFrame / totalFrames) * 100;
  const currentTimeSec = currentFrame / FPS;

  const seekFromPointer = useCallback(
    (clientX: number) => {
      if (!trackRef.current || !playerRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const targetFrame = Math.round(ratio * totalFrames);
      playerRef.current.seekTo(targetFrame);
    },
    [playerRef, totalFrames],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    seekFromPointer(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    seekFromPointer(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Safe ignore if capture already released
      }
      setIsDragging(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!playerRef.current) return;
    const step = e.shiftKey ? FPS * 5 : FPS; // 1s default, 5s with Shift
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      playerRef.current.seekTo(Math.max(0, currentFrame - step));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      playerRef.current.seekTo(Math.min(totalFrames, currentFrame + step));
    } else if (e.key === "Home") {
      e.preventDefault();
      playerRef.current.seekTo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      playerRef.current.seekTo(totalFrames);
    }
  };

  return (
    <div className="flex w-full flex-col gap-1.5">
      {/* Interactive Scrub Bar Track */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Seek video timeline"
        aria-valuenow={Math.round(currentTimeSec)}
        aria-valuemin={0}
        aria-valuemax={Math.round(durationSec)}
        aria-valuetext={`${formatTimecode(currentTimeSec)} of ${formatTimecode(durationSec)}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        className="group relative flex h-3 w-full cursor-pointer touch-none select-none items-center focus-visible:outline-none"
      >
        {/* Track background */}
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-raised transition-all group-hover:h-2 group-focus-visible:ring-1 group-focus-visible:ring-edit">
          {/* Progress fill (amber) */}
          <div className="h-full bg-now" style={{ width: `${progressPercent}%` }} />
        </div>

        {/* Thumb */}
        <div
          className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-now ring-2 ring-void shadow-sm transition-transform group-hover:scale-110"
          style={{ left: `${progressPercent}%` }}
        />
      </div>

      {/* Timecode display */}
      <div className="flex items-center justify-between text-[11px] tabular text-ink-muted">
        <span>
          <span className="font-medium text-ink">{formatTimecode(currentTimeSec)}</span>
          {" / "}
          {formatTimecode(durationSec)}
        </span>
      </div>
    </div>
  );
}
