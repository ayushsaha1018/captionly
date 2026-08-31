import React from "react";
import type { SubtitleLine, SubtitleStyle, PaintOnOptions } from "../types";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options: PaintOnOptions;
  currentTime: number;
  frame: number;
  fps: number;
}

export const PaintOnAnimation: React.FC<AnimationProps> = ({
  line,
  style,
  currentTime,
}) => {
  const duration = Math.max(0.1, line.end - line.start);
  const progress = Math.max(0, Math.min(1, (currentTime - line.start) / duration));
  const fullText = line.words.map((w) => w.text).join(" ");
  const charsRevealed = Math.floor(progress * fullText.length);

  const strokeStyle =
    style.strokeWidth > 0
      ? {
          WebkitTextStroke: `${style.strokeWidth}px ${style.stroke}`,
          paintOrder: "stroke fill",
        }
      : {};

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
      {fullText.split("").map((char, index) => {
        const isVisible = index <= charsRevealed;
        return (
          <span
            key={index}
            style={{
              color: isVisible ? style.activeColor : style.color,
              opacity: isVisible ? 1 : 0.2,
              filter: isVisible ? "none" : "blur(4px)",
              transition: "filter 0.1s ease, opacity 0.1s ease",
              ...strokeStyle,
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        );
      })}
    </div>
  );
};
