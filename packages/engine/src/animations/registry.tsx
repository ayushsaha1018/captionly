import React from "react";
import type { SubtitleLine, SubtitleStyle, AnimationConfig } from "../types";
import { ColorFillAnimation } from "./ColorFillAnimation";
import { PopOnAnimation } from "./PopOnAnimation";
import { TypewriterAnimation } from "./TypewriterAnimation";
import { WipeAnimation } from "./WipeAnimation";
import { RollUpAnimation } from "./RollUpAnimation";
import { PaintOnAnimation } from "./PaintOnAnimation";
import { FlapBoardAnimation } from "./FlapBoardAnimation";
import { TickerAnimation } from "./TickerAnimation";
import { DigitalMatrixAnimation } from "./DigitalMatrixAnimation";

interface SubtitleAnimationRendererProps {
  line: SubtitleLine;
  style: SubtitleStyle;
  animation: AnimationConfig;
  currentTime: number;
  frame: number;
  fps: number;
}

export const SubtitleAnimationRenderer: React.FC<SubtitleAnimationRendererProps> = ({
  line,
  style,
  animation,
  currentTime,
  frame,
  fps,
}) => {
  switch (animation.type) {
    case "colorFill":
      return (
        <ColorFillAnimation
          line={line}
          style={style}
          options={animation.options}
          currentTime={currentTime}
          frame={frame}
          fps={fps}
        />
      );
    case "popOn":
      return (
        <PopOnAnimation
          line={line}
          style={style}
          options={animation.options}
          currentTime={currentTime}
          frame={frame}
          fps={fps}
        />
      );
    case "typewriter":
      return (
        <TypewriterAnimation
          line={line}
          style={style}
          options={animation.options}
          currentTime={currentTime}
          frame={frame}
          fps={fps}
        />
      );
    case "wipe":
      return (
        <WipeAnimation
          line={line}
          style={style}
          options={animation.options}
          currentTime={currentTime}
          frame={frame}
          fps={fps}
        />
      );
    case "rollUp":
      return (
        <RollUpAnimation
          line={line}
          style={style}
          options={animation.options}
          currentTime={currentTime}
          frame={frame}
          fps={fps}
        />
      );
    case "paintOn":
      return (
        <PaintOnAnimation
          line={line}
          style={style}
          options={animation.options}
          currentTime={currentTime}
          frame={frame}
          fps={fps}
        />
      );
    case "flapBoard":
      return (
        <FlapBoardAnimation
          line={line}
          style={style}
          options={animation.options}
          currentTime={currentTime}
          frame={frame}
          fps={fps}
        />
      );
    case "ticker":
      return (
        <TickerAnimation
          line={line}
          style={style}
          options={animation.options}
          currentTime={currentTime}
        />
      );
    case "digitalMatrix":
      return (
        <DigitalMatrixAnimation
          line={line}
          style={style}
          options={animation.options}
          currentTime={currentTime}
          frame={frame}
        />
      );
    default:
      return (
        <ColorFillAnimation
          line={line}
          style={style}
          options={{ transition: "hardCut" }}
          currentTime={currentTime}
          frame={frame}
          fps={fps}
        />
      );
  }
};
