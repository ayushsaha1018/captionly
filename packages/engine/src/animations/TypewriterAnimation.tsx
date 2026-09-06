import React from "react";
import type { SubtitleLine, SubtitleStyle, TypewriterOptions } from "../types";
import { resolveWordFillCss, resolveWordShadowCss, resolveWordStrokeCss } from "../utils/textStyle";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options: TypewriterOptions;
  currentTime: number;
  frame: number;
  fps: number;
}

export const TypewriterAnimation: React.FC<AnimationProps> = ({
  line,
  style,
  options,
  currentTime,
  frame,
  fps,
}) => {
  const fullText = line.words.map((w) => w.text).join(" ");
  const duration = Math.max(0.1, line.end - line.start);
  const elapsed = Math.max(0, currentTime - line.start);
  const ratio = Math.min(1, elapsed / duration);

  const charCount = Math.floor(ratio * fullText.length);
  const visibleText = fullText.slice(0, charCount);

  const blinkRate = options.blinkRate || 1.4;
  const cursorBlink = Math.floor((frame / fps) * blinkRate * 2) % 2 === 0;
  const cursorChar = options.cursor || "|";

  return (
    <div
      className="text-center font-mono whitespace-pre-wrap"
      style={{
        ...resolveWordFillCss(style, false),
        ...resolveWordStrokeCss(style),
        ...resolveWordShadowCss(style, false),
      }}
    >
      <span>{visibleText}</span>
      <span
        style={{
          color: style.activeColor,
          WebkitTextFillColor: style.activeColor,
          opacity: cursorBlink ? 1 : 0,
          marginLeft: "2px",
        }}
      >
        {cursorChar}
      </span>
    </div>
  );
};
