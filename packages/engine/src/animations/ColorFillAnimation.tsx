import React from "react";
import { spring } from "remotion";
import type { SubtitleLine, SubtitleStyle, ColorFillOptions } from "../types";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options: ColorFillOptions;
  currentTime: number;
  frame: number;
  fps: number;
}

export const ColorFillAnimation: React.FC<AnimationProps> = ({
  line,
  style,
  currentTime,
  frame,
  fps,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
      {line.words.map((word) => {
        const isActive = currentTime >= word.start && currentTime <= word.end;
        const isPast = currentTime > word.end;

        const wordStartFrame = Math.round(word.start * fps);
        const elapsedFrames = Math.max(0, frame - wordStartFrame);

        let scale = 1;
        if (isActive && style.activeScale > 1) {
          const pop = spring({
            frame: elapsedFrames,
            fps,
            config: { damping: 12, mass: 0.5, stiffness: 140 },
          });
          scale = 1 + (style.activeScale - 1) * pop;
        }

        const color = isActive
          ? style.activeColor
          : isPast
            ? style.activeColor
            : style.color;

        const strokeStyle =
          style.strokeWidth > 0
            ? {
                WebkitTextStroke: `${style.strokeWidth}px ${style.stroke}`,
                paintOrder: "stroke fill",
              }
            : {};

        const shadowStyle =
          style.shadowBlur > 0
            ? {
                textShadow: `0 0 ${style.shadowBlur}px ${isActive ? style.activeColor : "rgba(0,0,0,0.8)"}`,
              }
            : {};

        return (
          <span
            key={word.id}
            style={{
              color,
              transform: `scale(${scale})`,
              transformOrigin: "center bottom",
              display: "inline-block",
              transition: "color 0.1s ease",
              ...strokeStyle,
              ...shadowStyle,
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
