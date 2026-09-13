import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { SubtitleOverlayProps } from "../types";
import { SubtitleAnimationRenderer } from "../animations/registry";
import { calculateSubtitleLayout } from "../utils/geometry";
import { GoogleFontLoader } from "../fonts/googleFonts";

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  lines,
  style,
  position,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const currentTime = frame / fps;

  const fontLoader = (
    <GoogleFontLoader fontFamily={style.fontFamily} fontWeight={style.fontWeight} />
  );

  const activeLine = lines.find(
    (line) => currentTime >= line.start && currentTime <= line.end,
  );

  if (!activeLine) {
    return fontLoader;
  }

  const { scale, maxWidth } = calculateSubtitleLayout(width, height, style.boxWidth);
  const scaledFontSize = Math.round(style.fontSize * scale);
  const scaledPadX = Math.round((style.bgPaddingX ?? 24) * scale);
  const scaledPadY = Math.round((style.bgPaddingY ?? 12) * scale);
  const scaledRadius = Math.round((style.bgRadius ?? 16) * scale);

  // Calculate percentage-based or absolute position (reference composition 1920x1080)
  const posX = position.x <= 100 ? `${position.x}%` : `${(position.x / 1920) * 100}%`;
  const posY = position.y <= 100 ? `${position.y}%` : `${(position.y / 1080) * 100}%`;

  const anchorTransform =
    style.boxAnchor === "top"
      ? "translate(-50%, 0%)"
      : style.boxAnchor === "bottom"
        ? "translate(-50%, -100%)"
        : "translate(-50%, -50%)";

  const bgRgba =
    style.bgOpacity > 0
      ? `color-mix(in srgb, ${style.bgColor || "#000000"} ${Math.round(style.bgOpacity * 100)}%, transparent)`
      : "transparent";

  const scaledStyle = {
    ...style,
    fontSize: scaledFontSize,
    strokeWidth: Math.round((style.strokeWidth ?? 0) * scale),
    shadowBlur: Math.round((style.shadowBlur ?? 0) * scale),
    shadowOffsetX: Math.round((style.shadowOffsetX ?? 0) * scale),
    shadowOffsetY: Math.round((style.shadowOffsetY ?? 0) * scale),
  };

  return (
    <>
      {fontLoader}
      <div
        style={{
          position: "absolute",
          left: posX,
          top: posY,
          transform: anchorTransform,
          maxWidth: `${maxWidth}px`,
          width: "max-content",
          fontFamily: style.fontFamily,
          fontWeight: style.fontWeight,
          fontSize: `${scaledFontSize}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        <div
          style={{
            backgroundColor: bgRgba,
            borderRadius: `${scaledRadius}px`,
            padding: `${scaledPadY}px ${scaledPadX}px`,
            backdropFilter: style.bgOpacity > 0 ? "blur(4px)" : "none",
          }}
        >
          <SubtitleAnimationRenderer
            line={activeLine}
            style={scaledStyle}
            animation={animation}
            currentTime={currentTime}
            frame={frame}
            fps={fps}
          />
        </div>
      </div>
    </>
  );
};
