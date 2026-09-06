import React from "react";
import { AbsoluteFill } from "remotion";
import { Video } from "@remotion/media";
import type { SubtitleCompositionProps } from "../types";
import { SubtitleOverlay } from "./SubtitleOverlay";

export const MainComposition: React.FC<SubtitleCompositionProps> = ({
  videoSrc,
  subtitles,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {/* Underlying Video */}
      {videoSrc && (
        <Video
          src={videoSrc}
          style={{ width: "100%", height: "100%" }}
          objectFit="contain"
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
