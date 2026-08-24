import React from "react";
import { spring } from "remotion";
import type { SubtitleLine, SubtitleStyle, PopOnOptions } from "../types";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options: PopOnOptions;
  currentTime: number;
  frame: number;
  fps: number;
}

export const PopOnAnimation: React.FC<AnimationProps> = ({
  line,
  style,
  options,
  currentTime,
  frame,
  fps,
}) => {
  const popScale = options.popScale ?? 1.15;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
      {line.words.map((word) => {
        const hasStarted = currentTime >= word.start;
        const isActive = currentTime >= word.start && currentTime <= word.end;

        if (!hasStarted) {
          return (
            <span
              key={word.id}
              style={{
                opacity: 0,
                display: "inline-block",
              }}
            >
              {word.text}
            </span>
          );
        }

        const wordStartFrame = Math.round(word.start * fps);
        const elapsedFrames = Math.max(0, frame - wordStartFrame);

        const progress = spring({
          frame: elapsedFrames,
          fps,
          config: { damping: 10, mass: 0.4, stiffness: 160 },
        });

        const currentScale = progress * (isActive ? popScale : 1);
        const color = isActive ? style.activeColor : style.color;

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
              opacity: Math.min(1, progress * 1.5),
              transform: `scale(${currentScale})`,
              transformOrigin: "center center",
              display: "inline-block",
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
