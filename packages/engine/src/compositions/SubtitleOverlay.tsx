import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { SubtitleOverlayProps } from "../types";
import { SubtitleAnimationRenderer } from "../animations/registry";
import { calculateSubtitleLayout } from "../utils/geometry";

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  lines,
  style,
  position,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const currentTime = frame / fps;

  const activeLine = lines.find(
    (line) => currentTime >= line.start && currentTime <= line.end,
  );

  if (!activeLine) {
    return null;
  }

  const { scale, maxWidth } = calculateSubtitleLayout(width, height, style.boxWidth);
  const scaledFontSize = Math.round(style.fontSize * scale);
  const scaledPadX = Math.round((style.bgPaddingX ?? 24) * scale);
  const scaledPadY = Math.round((style.bgPaddingY ?? 12) * scale);
  const scaledRadius = Math.round((style.bgRadius ?? 16) * scale);

  // Calculate percentage-based or absolute position (default composition 1920x1080)
  const posX = position.x <= 100 ? `${position.x}%` : `${(position.x / (width || 1920)) * 100}%`;
  const posY = position.y <= 100 ? `${position.y}%` : `${(position.y / (height || 1080)) * 100}%`;

  const anchorTransform =
    style.boxAnchor === "top"
      ? "translate(-50%, 0%)"
      : style.boxAnchor === "bottom"
        ? "translate(-50%, -100%)"
        : "translate(-50%, -50%)";

  const bgRgba =
    style.bgOpacity > 0
      ? hexToRgba(style.bgColor, style.bgOpacity)
      : "transparent";

  return (
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
          style={style}
          animation={animation}
          currentTime={currentTime}
          frame={frame}
          fps={fps}
        />
      </div>
    </div>
  );
};

function hexToRgba(hex: string, opacity: number): string {
  const cleanHex = hex.replace("#", "");
  let r = 0;
  let g = 0;
  let b = 0;

  if (cleanHex.length === 3) {
    const c0 = cleanHex.charAt(0);
    const c1 = cleanHex.charAt(1);
    const c2 = cleanHex.charAt(2);
    r = parseInt(c0 + c0, 16);
    g = parseInt(c1 + c1, 16);
    b = parseInt(c2 + c2, 16);
  } else if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  }

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
