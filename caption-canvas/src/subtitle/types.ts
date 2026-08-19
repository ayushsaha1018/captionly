export type Word = {
  id: string;
  text: string;
  start: number;
  end: number;
};

export type SubtitleLine = {
  id: string;
  start: number;
  end: number;
  words: Word[];
};

export type BoxAnchor = "top" | "bottom" | "center";

export type SubtitleStyle = {
  fontFamily: string;
  fontWeight: 400 | 600 | 700 | 900;
  fontSize: number;
  color: string;
  activeColor: string;
  stroke: string;
  strokeWidth: number;
  activeScale: number;
  shadowBlur: number;
  // Layout
  boxWidth: number;          // wrap width (canvas px)
  boxAnchor: BoxAnchor;      // how the box grows when wrapping
  // Background
  bgColor: string;           // hex
  bgOpacity: number;         // 0..1 (0 = no background)
  bgRadius: number;          // px
  bgPaddingX: number;        // px
  bgPaddingY: number;        // px
};

export type SubtitlePosition = {
  x: number;
  y: number;
};

export type SafeZonePreset = "none" | "instagram" | "tiktok" | "youtube";

// ===== Animation system =====

export type AnimationType =
  | "colorFill"
  | "typewriter"
  | "rollUp"
  | "paintOn"
  | "popOn"
  | "wipe"
  | "flapBoard"
  | "ticker"
  | "digitalMatrix";

export type ColorFillOptions = {
  transition: "hardCut" | "gradient";
};

export type TypewriterOptions = {
  cursor: "_" | "|" | ".";
  blinkRate: number; // blinks per second
  maxCps: number;    // cap so short lines don't type insanely fast
};

export type RollUpOptions = {
  lineLimit: number;
  transition: "hardCut" | "soft";
  lineSpacing: number;
};

export type PaintOnOptions = {
  direction: "ltr" | "rtl";
  maxCps: number;
};

export type PopOnOptions = {
  popScale: number;     // overshoot scale (e.g. 1.15)
  popDuration: number;  // seconds for pop-in
};

export type WipeOptions = {
  direction: "ltr" | "rtl" | "ttb" | "btt";
};

export type FlapBoardOptions = {
  flapDuration: number; // seconds each char cycles before settling
  cyclesPerChar: number;
};

export type TickerOptions = {
  speed: number; // px per second (canvas px)
  gap: number;   // px gap between repeated lines
};

export type DigitalMatrixOptions = {
  glitchAmplitude: number; // px
  glowIntensity: number;   // 0..1
};

export type AnimationConfig =
  | { type: "colorFill"; options: ColorFillOptions }
  | { type: "typewriter"; options: TypewriterOptions }
  | { type: "rollUp"; options: RollUpOptions }
  | { type: "paintOn"; options: PaintOnOptions }
  | { type: "popOn"; options: PopOnOptions }
  | { type: "wipe"; options: WipeOptions }
  | { type: "flapBoard"; options: FlapBoardOptions }
  | { type: "ticker"; options: TickerOptions }
  | { type: "digitalMatrix"; options: DigitalMatrixOptions };
