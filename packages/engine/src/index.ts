export const CANVAS_W = 1920;
export const CANVAS_H = 1080;

// Core Types & Constants
export * from "./types";

// Sample & Default Data
export * from "./sampleData";
export * from "./presets";
export * from "./fonts/googleFonts";

// Compositions
export { MainComposition } from "./compositions/MainComposition";
export { SubtitleOverlay } from "./compositions/SubtitleOverlay";

// Animations & Strategy Registry
export { SubtitleAnimationRenderer } from "./animations/registry";
export { ColorFillAnimation } from "./animations/ColorFillAnimation";
export { PopOnAnimation } from "./animations/PopOnAnimation";
export { TypewriterAnimation } from "./animations/TypewriterAnimation";
export { WipeAnimation } from "./animations/WipeAnimation";
export { RollUpAnimation } from "./animations/RollUpAnimation";
export { PaintOnAnimation } from "./animations/PaintOnAnimation";
export { FlapBoardAnimation } from "./animations/FlapBoardAnimation";
export { DigitalMatrixAnimation } from "./animations/DigitalMatrixAnimation";

// Geometry & Layout
export * from "./utils/geometry";

// Word timing
export * from "./wordTiming";
