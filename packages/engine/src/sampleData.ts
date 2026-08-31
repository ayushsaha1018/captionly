import type {
  SubtitleLine,
  SubtitleStyle,
  SubtitlePosition,
  AnimationConfig,
  AnimationType,
} from "./types";

export const sampleSubtitles: SubtitleLine[] = [
  {
    id: "line-1",
    start: 0.2,
    end: 4.5,
    words: [
      { id: "w1", text: "This", start: 0.2, end: 0.7 },
      { id: "w2", text: "is", start: 0.7, end: 1.0 },
      { id: "w3", text: "a", start: 1.0, end: 1.2 },
      { id: "w4", text: "Remotion", start: 1.2, end: 1.9 },
      { id: "w5", text: "subtitle", start: 1.9, end: 2.7 },
      { id: "w6", text: "preview", start: 2.7, end: 3.5 },
      { id: "w7", text: "editor", start: 3.5, end: 4.4 },
    ],
  },
  {
    id: "line-2",
    start: 5.0,
    end: 9.5,
    words: [
      { id: "w8", text: "Smooth", start: 5.0, end: 5.7 },
      { id: "w9", text: "word", start: 5.7, end: 6.2 },
      { id: "w10", text: "by", start: 6.2, end: 6.5 },
      { id: "w11", text: "word", start: 6.5, end: 7.0 },
      { id: "w12", text: "animation", start: 7.0, end: 8.2 },
      { id: "w13", text: "powered", start: 8.2, end: 8.9 },
      { id: "w14", text: "by", start: 8.9, end: 9.1 },
      { id: "w15", text: "Remotion", start: 9.1, end: 9.5 },
    ],
  },
  {
    id: "line-3",
    start: 10.0,
    end: 15.0,
    words: [
      { id: "w16", text: "Declarative", start: 10.0, end: 10.8 },
      { id: "w17", text: "React", start: 10.8, end: 11.6 },
      { id: "w18", text: "compositions", start: 11.6, end: 12.5 },
      { id: "w19", text: "for", start: 12.5, end: 12.8 },
      { id: "w20", text: "every", start: 12.8, end: 13.3 },
      { id: "w21", text: "style.", start: 13.3, end: 14.5 },
    ],
  },
];

export const defaultStyle: SubtitleStyle = {
  fontFamily: "Inter, system-ui, -apple-system, sans-serif",
  fontWeight: 900,
  fontSize: 84,
  color: "#ffffff",
  activeColor: "#FFD60A",
  stroke: "#000000",
  strokeWidth: 6,
  activeScale: 1.25,
  shadowBlur: 24,
  boxWidth: 1400,
  boxAnchor: "bottom",
  bgColor: "#000000",
  bgOpacity: 0,
  bgRadius: 16,
  bgPaddingX: 24,
  bgPaddingY: 12,
};

export const defaultPosition: SubtitlePosition = {
  x: 960,
  y: 880,
};

export const defaultAnimation: AnimationConfig = {
  type: "colorFill",
  options: { transition: "hardCut" },
};

export const defaultOptionsFor = (
  type: AnimationType,
): AnimationConfig["options"] => {
  switch (type) {
    case "colorFill":
      return { transition: "hardCut" };
    case "typewriter":
      return { cursor: "|", blinkRate: 1.4, maxCps: 35 };
    case "rollUp":
      return { lineLimit: 3, transition: "soft", lineSpacing: 12 };
    case "paintOn":
      return { direction: "ltr", maxCps: 35 };
    case "popOn":
      return { popScale: 1.15, popDuration: 0.25 };
    case "wipe":
      return { direction: "ltr" };
    case "flapBoard":
      return { flapDuration: 0.5, cyclesPerChar: 8 };
    case "ticker":
      return { speed: 220, gap: 200 };
    case "digitalMatrix":
      return { glitchAmplitude: 3, glowIntensity: 0.8 };
  }
};
