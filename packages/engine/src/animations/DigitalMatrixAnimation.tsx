import React from "react";
import type { SubtitleLine, SubtitleStyle, DigitalMatrixOptions } from "../types";
import { strokeShadowLayers } from "../utils/textStyle";

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
        fontFamily: style.fontFamily || "monospace",
      }}
    >
      {line.words.map((word) => {
        const isActive = currentTime >= word.start && currentTime <= word.end;

        const glitchX = isActive ? (Math.sin(frame * 1.5) * glitchAmp).toFixed(1) : 0;
        const glitchY = isActive ? (Math.cos(frame * 2) * (glitchAmp / 2)).toFixed(1) : 0;

        const layers = strokeShadowLayers(style);
        if (isActive) {
          layers.push(`0 0 ${12 * glow}px ${style.activeColor}`, `0 0 ${24 * glow}px #00ff66`);
        }

        return (
          <span
            key={word.id}
            style={{
              color: isActive ? style.activeColor : style.color,
              transform: `translate(${glitchX}px, ${glitchY}px)`,
              textShadow: layers.length > 0 ? layers.join(", ") : "none",
              display: "inline-block",
              margin: "0 0.12em",
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
