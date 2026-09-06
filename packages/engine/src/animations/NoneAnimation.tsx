import React from "react";
import type { SubtitleLine, SubtitleStyle } from "../types";
import { resolveWordFillCss, resolveWordShadowCss, resolveWordStrokeCss } from "../utils/textStyle";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options?: Record<string, never>;
  currentTime?: number;
  frame?: number;
  fps?: number;
}

/**
 * NoneAnimation renders subtitle lines statically (classic SRT style).
 * Every style (font, weight, size, color, stroke, text shadow) is applied
 * to the line as a whole without per-word active highlights, scale, or glows.
 */
export const NoneAnimation: React.FC<AnimationProps> = ({ line, style }) => {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        columnGap: "0.28em",
        rowGap: "0.15em",
        textAlign: "center",
        ...resolveWordFillCss(style, false),
        ...resolveWordStrokeCss(style),
        ...resolveWordShadowCss(style, false),
      }}
    >
      {line.words.map((word) => (
        <span
          key={word.id}
          style={{
            display: "inline-block",
            margin: "0 0.12em",
          }}
        >
          {word.text}
        </span>
      ))}
    </div>
  );
};
