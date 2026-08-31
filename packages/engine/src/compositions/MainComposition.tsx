import React from "react";
import { AbsoluteFill, Video } from "remotion";
import type { SubtitleCompositionProps } from "../types";
import { SubtitleOverlay } from "./SubtitleOverlay";

export const MainComposition: React.FC<SubtitleCompositionProps> = ({
  videoSrc,
  subtitles,
}) => {
  return (
    <AbsoluteFill className="bg-black">
      {/* Underlying Video */}
      {videoSrc && (
        <Video
          src={videoSrc}
          className="w-full h-full object-contain"
        />
      )}

      {/* Subtitle Overlay */}
      {subtitles && (
        <SubtitleOverlay
          lines={subtitles.lines}
          style={subtitles.style}
          position={subtitles.position}
          animation={subtitles.animation}
        />
      )}
    </AbsoluteFill>
  );
};
