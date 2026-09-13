import React from "react";
import type { SubtitleLine, SubtitleStyle, AnimationConfig, AnimationType } from "../types";
import { NoneAnimation } from "./NoneAnimation";
import { ColorFillAnimation } from "./ColorFillAnimation";
import { PopOnAnimation } from "./PopOnAnimation";
import { TypewriterAnimation } from "./TypewriterAnimation";
import { WipeAnimation } from "./WipeAnimation";
import { RollUpAnimation } from "./RollUpAnimation";
import { PaintOnAnimation } from "./PaintOnAnimation";
import { FlapBoardAnimation } from "./FlapBoardAnimation";
import { DigitalMatrixAnimation } from "./DigitalMatrixAnimation";

interface SubtitleAnimationRendererProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  animation: AnimationConfig;
  currentTime: number;
  frame: number;
  fps: number;
}

// Map each animation type to its renderer component
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ANIMATION_COMPONENTS: Record<AnimationType, React.ComponentType<any>> = {
  none: NoneAnimation,
  colorFill: ColorFillAnimation,
  popOn: PopOnAnimation,
  typewriter: TypewriterAnimation,
  wipe: WipeAnimation,
  rollUp: RollUpAnimation,
  paintOn: PaintOnAnimation,
  flapBoard: FlapBoardAnimation,
  digitalMatrix: DigitalMatrixAnimation,
};

export const SubtitleAnimationRenderer: React.FC<SubtitleAnimationRendererProps> = ({
  line,
  style,
  animation,
  currentTime,
  frame,
  fps,
}) => {
  const Component = ANIMATION_COMPONENTS[animation.type] ?? ColorFillAnimation;
  const options =
    animation.options ?? (animation.type === "colorFill" ? { transition: "hardCut" } : {});

  return (
    <Component
      line={line}
      style={style}
      options={options}
      currentTime={currentTime}
      frame={frame}
      fps={fps}
    />
  );
};
