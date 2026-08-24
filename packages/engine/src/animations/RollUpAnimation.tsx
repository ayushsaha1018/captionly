import React from "react";
import type { SubtitleLine, SubtitleStyle, RollUpOptions } from "../types";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options: RollUpOptions;
  currentTime: number;
  frame: number;
  fps: number;
}

export const RollUpAnimation: React.FC<AnimationProps> = ({
  line,
  style,
  currentTime,
}) => {
  const strokeStyle =
    style.strokeWidth > 0
      ? {
          WebkitTextStroke: `${style.strokeWidth}px ${style.stroke}`,
          paintOrder: "stroke fill",
        }
      : {};

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center"
      style={{
        lineHeight: 1.25,
      }}
    >
      {line.words.map((word) => {
        const isActive = currentTime >= word.start && currentTime <= word.end;
        const color = isActive ? style.activeColor : style.color;

        return (
          <span
            key={word.id}
            style={{
              color,
              transition: "all 0.15s ease-out",
              ...strokeStyle,
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
