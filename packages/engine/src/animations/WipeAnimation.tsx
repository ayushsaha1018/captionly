import React from "react";
import type { SubtitleLine, SubtitleStyle, WipeOptions } from "../types";
import { resolveWordFillCss, resolveWordShadowCss, resolveWordStrokeCss } from "../utils/textStyle";

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

  return (
    <div
      style={{
        position: "relative",
        textAlign: "center",
        whiteSpace: "pre-wrap",
      }}
    >
      {/* Background Dim Layer */}
      <span
        style={{
          opacity: 0.3,
          ...resolveWordFillCss(style, false),
          ...resolveWordStrokeCss(style),
        }}
      >
        {text}
      </span>

      {/* Wiped Highlight Layer */}
      <span
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          clipPath,
          ...resolveWordFillCss(style, true),
          ...resolveWordStrokeCss(style),
          ...resolveWordShadowCss(style, true),
        }}
      >
        {text}
      </span>
    </div>
  );
};
