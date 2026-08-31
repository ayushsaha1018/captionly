import React from "react";
import { Player, PlayerRef } from "@remotion/player";
import {
  MainComposition,
  type SubtitleCompositionProps,
  type SafeZonePreset,
} from "@captionly/engine";
import { SafeZones } from "./SafeZones";

interface StudioPlayerProps {
  videoSrc: string;
  subtitles: SubtitleCompositionProps["subtitles"];
  safeZone?: SafeZonePreset;
  durationInFrames?: number;
  fps?: number;
  playerRef?: React.RefObject<PlayerRef | null>;
  className?: string;
}

export function StudioPlayer({
  videoSrc,
  subtitles,
  safeZone = "none",
  durationInFrames = 450,
  fps = 30,
  playerRef,
  className = "",
}: StudioPlayerProps) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10 select-none aspect-video ${className}`}
    >
      <Player
        ref={playerRef}
        component={MainComposition}
        inputProps={{
          videoSrc,
          subtitles,
        }}
        durationInFrames={durationInFrames}
        compositionWidth={1920}
        compositionHeight={1080}
        fps={fps}
        controls
        loop
        className="w-full h-full"
        style={{
          width: "100%",
          height: "100%",
        }}
      />
      <SafeZones preset={safeZone} />
    </div>
  );
}
