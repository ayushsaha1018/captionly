import React from "react";
import type { SubtitleLine, SubtitleStyle, TickerOptions } from "../types";
import { resolveWordFillCss, resolveWordShadowCss, resolveWordStrokeCss } from "../utils/textStyle";

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

  return (
    <div className="overflow-hidden w-full whitespace-nowrap">
      <div
        className="inline-block"
        style={{
          transform: `translateX(${offset}px)`,
          ...resolveWordFillCss(style, true),
          ...resolveWordStrokeCss(style),
          ...resolveWordShadowCss(style, true),
        }}
      >
        <span className="mr-12">{text}</span>
        <span className="mr-12">{text}</span>
        <span className="mr-12">{text}</span>
      </div>
    </div>
  );
};
