import React from "react";
import type { SubtitleLine, SubtitleStyle, WipeOptions } from "../types";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options: WipeOptions;
  currentTime: number;
  frame: number;
  fps: number;
}

export const WipeAnimation: React.FC<AnimationProps> = ({
  line,
  style,
  options,
  currentTime,
}) => {
  const duration = Math.max(0.1, line.end - line.start);
  const progress = Math.max(0, Math.min(1, (currentTime - line.start) / duration));
  const percent = progress * 100;

  const direction = options.direction || "ltr";
  let clipPath = "none";

  switch (direction) {
    case "ltr":
      clipPath = `inset(0 ${100 - percent}% 0 0)`;
      break;
    case "rtl":
      clipPath = `inset(0 0 0 ${100 - percent}%)`;
      break;
    case "ttb":
      clipPath = `inset(0 0 ${100 - percent}% 0)`;
      break;
    case "btt":
      clipPath = `inset(${100 - percent}% 0 0 0)`;
      break;
  }

  const text = line.words.map((w) => w.text).join(" ");

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
          textShadow: `0 0 ${style.shadowBlur}px ${style.activeColor}`,
        }
      : {};

  return (
    <div className="relative text-center whitespace-pre-wrap">
      {/* Background Dim Layer */}
      <span
        style={{
          color: style.color,
          opacity: 0.3,
          ...strokeStyle,
        }}
      >
        {text}
      </span>

      {/* Wiped Highlight Layer */}
      <span
        className="absolute inset-0"
        style={{
          color: style.activeColor,
          clipPath,
          ...strokeStyle,
          ...shadowStyle,
        }}
      >
        {text}
      </span>
    </div>
  );
};
