import React from "react";
import type { SubtitleLine, SubtitleStyle, DigitalMatrixOptions } from "../types";

interface AnimationProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  options: DigitalMatrixOptions;
  currentTime: number;
  frame: number;
}

export const DigitalMatrixAnimation: React.FC<AnimationProps> = ({
  line,
  style,
  options,
  currentTime,
  frame,
}) => {
  const glitchAmp = options.glitchAmplitude ?? 3;
  const glow = options.glowIntensity ?? 0.8;

  const strokeStyle =
    style.strokeWidth > 0
      ? {
          WebkitTextStroke: `${style.strokeWidth}px ${style.stroke}`,
          paintOrder: "stroke fill",
        }
      : {};

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center font-mono">
      {line.words.map((word) => {
        const isActive = currentTime >= word.start && currentTime <= word.end;

        const glitchX = isActive ? (Math.sin(frame * 1.5) * glitchAmp).toFixed(1) : 0;
        const glitchY = isActive ? (Math.cos(frame * 2) * (glitchAmp / 2)).toFixed(1) : 0;

        return (
          <span
            key={word.id}
            style={{
              color: isActive ? style.activeColor : style.color,
              transform: `translate(${glitchX}px, ${glitchY}px)`,
              textShadow: isActive
                ? `0 0 ${12 * glow}px ${style.activeColor}, 0 0 ${24 * glow}px #00ff66`
                : "none",
              display: "inline-block",
              ...strokeStyle,
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
