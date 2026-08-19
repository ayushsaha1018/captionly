import type { AnimationStrategy } from "./types";
import type { AnimationType } from "../types";
import { ColorFillStrategy } from "./ColorFillStrategy";
import { TypewriterStrategy } from "./TypewriterStrategy";
import { RollUpStrategy } from "./RollUpStrategy";
import { PaintOnStrategy } from "./PaintOnStrategy";
import { PopOnStrategy } from "./PopOnStrategy";
import { WipeStrategy } from "./WipeStrategy";
import { FlapBoardStrategy } from "./FlapBoardStrategy";
import { TickerStrategy } from "./TickerStrategy";
import { DigitalMatrixStrategy } from "./DigitalMatrixStrategy";

export const createStrategy = (type: AnimationType): AnimationStrategy => {
  switch (type) {
    case "colorFill":
      return new ColorFillStrategy();
    case "typewriter":
      return new TypewriterStrategy();
    case "rollUp":
      return new RollUpStrategy();
    case "paintOn":
      return new PaintOnStrategy();
    case "popOn":
      return new PopOnStrategy();
    case "wipe":
      return new WipeStrategy();
    case "flapBoard":
      return new FlapBoardStrategy();
    case "ticker":
      return new TickerStrategy();
    case "digitalMatrix":
      return new DigitalMatrixStrategy();
  }
};

export const ANIMATION_LABELS: Record<AnimationType, string> = {
  colorFill: "Color Fill",
  typewriter: "Typewriter",
  rollUp: "Roll-Up",
  paintOn: "Paint-On",
  popOn: "Pop-On",
  wipe: "Wipe",
  flapBoard: "Flap Board",
  ticker: "Ticker",
  digitalMatrix: "Digital Matrix",
};
