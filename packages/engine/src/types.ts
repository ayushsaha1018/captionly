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
  // <=100 is treated as a percentage of composition width/height; >100 is an
  // absolute pixel value against the 1920x1080 reference composition.
  x: number; // Anchor X (e.g. 50 = centered)
  y: number; // Anchor Y (e.g. 92 = 92% down; combined with boxAnchor "bottom" this sets the bottom gap)
};

export type SafeZonePreset = "none" | "instagram" | "tiktok" | "youtube";

// ===== Animation Configuration =====

export type AnimationType =
  | "none"
  | "colorFill"
  | "popOn"
  | "typewriter"
  | "wipe"
  | "rollUp"
  | "paintOn"
  | "flapBoard"
  | "digitalMatrix";

export const ANIMATION_LABELS: Record<AnimationType, string> = {
  none: "None (Simple SRT)",
  colorFill: "Color Fill (Word by Word)",
  popOn: "Pop On (Bounce In)",
  typewriter: "Typewriter",
  wipe: "Wipe Reveal",
  rollUp: "Roll Up (Karaoke)",
  paintOn: "Paint On (Fade Reveal)",
  flapBoard: "Split Flap Board",
  digitalMatrix: "Digital Matrix Glitch",
};

export type NoneOptions = Record<string, never>;

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

export type DigitalMatrixOptions = {
  glitchAmplitude: number;
  glowIntensity: number;
};

export type AnimationConfig =
  | { type: "none"; options?: NoneOptions }
  | { type: "colorFill"; options: ColorFillOptions }
  | { type: "popOn"; options: PopOnOptions }
  | { type: "typewriter"; options: TypewriterOptions }
  | { type: "wipe"; options: WipeOptions }
  | { type: "rollUp"; options: RollUpOptions }
  | { type: "paintOn"; options: PaintOnOptions }
  | { type: "flapBoard"; options: FlapBoardOptions }
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
