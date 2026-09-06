import type { SubtitleStyle, AnimationConfig } from "./types";
import { defaultStyle } from "./sampleData";

export type StylePreset = {
  label: string;
  style: SubtitleStyle;
  animation: AnimationConfig;
};

export const PRESETS: Record<string, StylePreset> = {
  simpleSrt: {
    label: "Simple SRT",
    style: {
      ...defaultStyle,
      fontSize: 54,
      fontWeight: 600,
      activeColor: "#ffffff",
      strokeWidth: 2,
      stroke: "#000000",
      shadowBlur: 8,
      shadowColor: "#000000",
      activeScale: 1,
      activeGlowMultiplier: 1,
      bgOpacity: 0.6,
      bgRadius: 8,
      bgPaddingX: 16,
      bgPaddingY: 8,
    },
    animation: { type: "none", options: {} },
  },
  boldKaraoke: {
    label: "Bold Karaoke",
    style: {
      ...defaultStyle,
      fontSize: 84,
      fontWeight: 900,
      activeColor: "#FFD60A",
      activeScale: 1.3,
      strokeWidth: 8,
      shadowBlur: 20,
      activeGlowMultiplier: 1.6,
    },
    animation: { type: "colorFill", options: { transition: "hardCut" } },
  },
  cleanMinimal: {
    label: "Clean Minimal",
    style: {
      ...defaultStyle,
      fontWeight: 600,
      strokeWidth: 0,
      shadowBlur: 8,
      bgOpacity: 0.55,
      bgRadius: 12,
      activeScale: 1,
    },
    animation: { type: "paintOn", options: { direction: "ltr", maxCps: 35 } },
  },
  neonGlow: {
    label: "Neon Glow",
    style: {
      ...defaultStyle,
      color: "#e0f7ff",
      activeColor: "#00e5ff",
      shadowColor: "#00e5ff",
      shadowBlur: 36,
      activeGlowMultiplier: 2,
      strokeWidth: 0,
    },
    animation: { type: "wipe", options: { direction: "ltr" } },
  },
  typewriterMono: {
    label: "Typewriter",
    style: {
      ...defaultStyle,
      fontFamily: "Roboto Mono",
      fontWeight: 700,
      shadowBlur: 0,
    },
    animation: { type: "typewriter", options: { cursor: "|", blinkRate: 1.4, maxCps: 35 } },
  },
  digitalMatrix: {
    label: "Digital Matrix",
    style: {
      ...defaultStyle,
      fontFamily: "Roboto Mono",
      color: "#00ff00",
      activeColor: "#00ff66",
    },
    animation: { type: "digitalMatrix", options: { glitchAmplitude: 4, glowIntensity: 0.9 } },
  },
};
