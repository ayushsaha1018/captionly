import React from "react";
import type { SubtitleLine, SubtitleStyle, FlapBoardOptions } from "../types";
import { resolveWordFillCss, resolveWordShadowCss, resolveWordStrokeCss } from "../utils/textStyle";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options: FlapBoardOptions;
  currentTime: number;
  frame: number;
  fps: number;
}

const CHAR_SET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export const FlapBoardAnimation: React.FC<AnimationProps> = ({
  line,
  style,
  currentTime,
  frame,
}) => {
  const fullText = line.words.map((w) => w.text).join(" ").toUpperCase();
  const duration = Math.max(0.1, line.end - line.start);
  const progress = Math.max(0, Math.min(1, (currentTime - line.start) / duration));

  return (
    <div className="flex flex-wrap items-center justify-center gap-1 text-center font-mono">
      {fullText.split("").map((targetChar, index) => {
        if (targetChar === " ") {
          return <span key={index} className="w-4" />;
        }

        const charProgress = Math.max(0, Math.min(1, progress * fullText.length - index));
        const isSettled = charProgress >= 1;

        let displayChar = targetChar;
        if (!isSettled && charProgress > 0) {
          const charIndex = (index + frame) % CHAR_SET.length;
          displayChar = CHAR_SET[charIndex] || targetChar;
        } else if (charProgress === 0) {
          displayChar = "_";
        }

        return (
          <span
            key={index}
            className="inline-flex items-center justify-center rounded px-1"
            style={{
              backgroundColor: isSettled ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.4)",
              minWidth: "1.1em",
              ...resolveWordFillCss(style, isSettled),
              ...resolveWordStrokeCss(style),
              ...resolveWordShadowCss(style, isSettled),
            }}
          >
            {displayChar}
          </span>
        );
      })}
    </div>
  );
};
