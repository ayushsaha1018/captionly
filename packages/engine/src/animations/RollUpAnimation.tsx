import React from "react";
import type { SubtitleLine, SubtitleStyle, RollUpOptions } from "../types";
import { resolveWordFillCss, resolveWordShadowCss, resolveWordStrokeCss } from "../utils/textStyle";

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
        lineHeight: 1.25,
      }}
    >
      {line.words.map((word) => {
        const isActive = currentTime >= word.start && currentTime <= word.end;

        return (
          <span
            key={word.id}
            style={{
              display: "inline-block",
              margin: "0 0.12em",
              transition: "all 0.15s ease-out",
              ...resolveWordFillCss(style, isActive),
              ...resolveWordStrokeCss(style),
              ...resolveWordShadowCss(style, isActive),
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
