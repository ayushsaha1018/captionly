import React from "react";
import { spring } from "remotion";
import type { SubtitleLine, SubtitleStyle, ColorFillOptions } from "../types";
import { resolveWordFillCss, resolveWordShadowCss, resolveWordStrokeCss } from "../utils/textStyle";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options: ColorFillOptions;
  currentTime: number;
  frame: number;
  fps: number;
}

export const ColorFillAnimation: React.FC<AnimationProps> = ({
  line,
  style,
  currentTime,
  frame,
  fps,
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
      }}
    >
      {line.words.map((word) => {
        const isActive = currentTime >= word.start && currentTime <= word.end;
        const isPast = currentTime > word.end;

        const wordStartFrame = Math.round(word.start * fps);
        const elapsedFrames = Math.max(0, frame - wordStartFrame);

        let scale = 1;
        if (isActive && style.activeScale > 1) {
          const pop = spring({
            frame: elapsedFrames,
            fps,
            config: { damping: 12, mass: 0.5, stiffness: 140 },
          });
          scale = 1 + (style.activeScale - 1) * pop;
        }

        return (
          <span
            key={word.id}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "center bottom",
              display: "inline-block",
              margin: "0 0.12em",
              transition: "color 0.1s ease",
              ...resolveWordFillCss(style, isActive || isPast),
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
