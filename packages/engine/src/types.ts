export type Word = {
  id: string;
  text: string;
  start: number; // Seconds
  end: number;   // Seconds
};

export type SubtitleLine = {
  id: string;
  start: number; // Seconds
  end: number;   // Seconds
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
  shadowColor: string; // hex, base (non-active) shadow/glow color
  shadowOffsetX: number; // px
  shadowOffsetY: number; // px
  // Text-fill gradient (opt-in). Gradient runs from `color` to `textGradientTo`;
  // the active word always stays a flat `activeColor`, never gradient.
  textGradientEnabled: boolean;
  textGradientTo: string; // hex
  textGradientAngle: number; // degrees, CSS linear-gradient angle
  // Multiplies shadowBlur only while a word is in its active/highlighted state.
  activeGlowMultiplier: number;
  // Layout
  boxWidth: number; // wrap width in px (at 1920x1080 canvas scale)
  boxAnchor: BoxAnchor;
  // Background
  bgColor: string; // hex
  bgOpacity: number; // 0..1 (0 = transparent)
  bgRadius: number; // px
  bgPaddingX: number; // px
  bgPaddingY: number; // px
};

export type SubtitlePosition = {
  x: number; // Center X in composition pixels (e.g. 960)
  y: number; // Baseline / Anchor Y in composition pixels (e.g. 880)
};

export type SafeZonePreset = "none" | "instagram" | "tiktok" | "youtube";

// ===== Animation Configuration =====

export type AnimationType =
  | "colorFill"
  | "popOn"
  | "typewriter"
  | "wipe"
  | "rollUp"
  | "paintOn"
  | "flapBoard"
  | "ticker"
  | "digitalMatrix";

export const ANIMATION_LABELS: Record<AnimationType, string> = {
  colorFill: "Color Fill (Word by Word)",
  popOn: "Pop On (Bounce In)",
  typewriter: "Typewriter",
  wipe: "Wipe Reveal",
  rollUp: "Roll Up (Karaoke)",
  paintOn: "Paint On (Fade Reveal)",
  flapBoard: "Split Flap Board",
  ticker: "Ticker Tape Marquee",
  digitalMatrix: "Digital Matrix Glitch",
};

export type ColorFillOptions = {
  transition: "hardCut" | "gradient";
};

export type PopOnOptions = {
  popScale: number; // e.g. 1.2
  popDuration: number; // seconds
};

export type TypewriterOptions = {
  cursor: "_" | "|" | ".";
  blinkRate: number; // blinks per sec
  maxCps: number;
};

export type WipeOptions = {
  direction: "ltr" | "rtl" | "ttb" | "btt";
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

export type FlapBoardOptions = {
  flapDuration: number;
  cyclesPerChar: number;
};

export type TickerOptions = {
  speed: number;
  gap: number;
};

export type DigitalMatrixOptions = {
  glitchAmplitude: number;
  glowIntensity: number;
};

export type AnimationConfig =
  | { type: "colorFill"; options: ColorFillOptions }
  | { type: "popOn"; options: PopOnOptions }
  | { type: "typewriter"; options: TypewriterOptions }
  | { type: "wipe"; options: WipeOptions }
  | { type: "rollUp"; options: RollUpOptions }
  | { type: "paintOn"; options: PaintOnOptions }
  | { type: "flapBoard"; options: FlapBoardOptions }
  | { type: "ticker"; options: TickerOptions }
  | { type: "digitalMatrix"; options: DigitalMatrixOptions };

export interface SubtitleExportData {
  lines: SubtitleLine[];
  style: SubtitleStyle;
  position: SubtitlePosition;
  animation: AnimationConfig;
}

export interface SubtitleCompositionProps {
  videoSrc?: string;
  subtitles: SubtitleExportData;
}

export interface SubtitleOverlayProps {
  lines: SubtitleLine[];
  style: SubtitleStyle;
  position: SubtitlePosition;
  animation: AnimationConfig;
}
