import React from "react";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import type { StudioPlayerState } from "./useStudioPlayer";

interface StudioPlayerProps {
  player: StudioPlayerState;
  src: string;
  className?: string;
  children?: React.ReactNode;
}

export function StudioPlayer({ player, src, className = "", children }: StudioPlayerProps) {
  const { videoRef, containerRef, isBuffering, error, retry, togglePlay } = player;

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10 select-none ${className}`}
      style={{ aspectRatio: "16 / 9" }}
    >
      {/* Underlying Video Engine */}
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover cursor-pointer"
        onClick={togglePlay}
      />

      {/* Children Overlays (Fabric.js Subtitle Canvas, SafeZones) */}
      {children}

      {/* Buffering Spinner Overlay */}
      {isBuffering && !error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 backdrop-blur-[1px] pointer-events-none transition-opacity">
          <div className="flex flex-col items-center gap-2 rounded-lg bg-background/80 px-4 py-3 text-xs font-medium text-foreground shadow-lg backdrop-blur-md">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>Buffering...</span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 text-center text-white">
          <AlertCircle className="h-10 w-10 text-destructive animate-pulse" />
          <div className="max-w-md space-y-1">
            <p className="text-sm font-semibold">Unable to load video</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
          <button
            onClick={retry}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
