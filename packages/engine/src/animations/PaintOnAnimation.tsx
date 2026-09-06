import React from "react";
import type { SubtitleLine, SubtitleStyle, PaintOnOptions } from "../types";
import { resolveWordFillCss, resolveWordShadowCss, resolveWordStrokeCss } from "../utils/textStyle";

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

  return (
    // Plain inline text flow, not flex: each char is its own span for the
    // per-character reveal, but a flex container's gap would apply uniformly
    // between every char (including the literal " " word-boundary span) and
    // trims that space's own width away, erasing the word gap entirely.
    <div
      style={{
        whiteSpace: "pre-wrap",
        textAlign: "center",
        lineHeight: 1.4,
      }}
    >
      {fullText.split("").map((char, index) => {
        const isVisible = index <= charsRevealed;
        return (
          <span
            key={index}
            style={{
              opacity: isVisible ? 1 : 0.2,
              filter: isVisible ? "none" : "blur(4px)",
              transition: "filter 0.1s ease, opacity 0.1s ease",
              ...resolveWordFillCss(style, isVisible),
              ...resolveWordStrokeCss(style),
              ...resolveWordShadowCss(style, isVisible),
            }}
          >
            {char === " " ? " " : char}
          </span>
        );
      })}
    </div>
  );
};
