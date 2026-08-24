import React from "react";
import type { SubtitleLine, SubtitleStyle, TickerOptions } from "../types";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options: TickerOptions;
  currentTime: number;
}

export const TickerAnimation: React.FC<AnimationProps> = ({
  line,
  style,
  options,
  currentTime,
}) => {
  const speed = options.speed || 220;
  const offset = -((currentTime * speed) % 1000);
  const text = line.words.map((w) => w.text).join(" ");

  const strokeStyle =
    style.strokeWidth > 0
      ? {
          WebkitTextStroke: `${style.strokeWidth}px ${style.stroke}`,
          paintOrder: "stroke fill",
        }
      : {};

  return (
    <div className="overflow-hidden w-full whitespace-nowrap">
      <div
        className="inline-block"
        style={{
          transform: `translateX(${offset}px)`,
          color: style.activeColor,
          ...strokeStyle,
        }}
      >
        <span className="mr-12">{text}</span>
        <span className="mr-12">{text}</span>
        <span className="mr-12">{text}</span>
      </div>
    </div>
  );
};
