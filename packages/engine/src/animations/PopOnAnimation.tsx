import React from "react";
import { spring } from "remotion";
import type { SubtitleLine, SubtitleStyle, PopOnOptions } from "../types";
import { resolveWordFillCss, resolveWordShadowCss, resolveWordStrokeCss } from "../utils/textStyle";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options: PopOnOptions;
  currentTime: number;
  frame: number;
  fps: number;
}

export const PopOnAnimation: React.FC<AnimationProps> = ({
  line,
  style,
  options,
  currentTime,
  frame,
  fps,
}) => {
  const popScale = options.popScale ?? 1.15;

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
        const hasStarted = currentTime >= word.start;
        const isActive = currentTime >= word.start && currentTime <= word.end;

        if (!hasStarted) {
          return (
            <span
              key={word.id}
              style={{
                opacity: 0,
                display: "inline-block",
                margin: "0 0.12em",
              }}
            >
              {word.text}
            </span>
          );
        }

        const wordStartFrame = Math.round(word.start * fps);
        const elapsedFrames = Math.max(0, frame - wordStartFrame);

        const progress = spring({
          frame: elapsedFrames,
          fps,
          config: { damping: 10, mass: 0.4, stiffness: 160 },
        });

        const currentScale = progress * (isActive ? popScale : 1);

        return (
          <span
            key={word.id}
            style={{
              opacity: Math.min(1, progress * 1.5),
              transform: `scale(${currentScale})`,
              transformOrigin: "center center",
              display: "inline-block",
              margin: "0 0.12em",
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
