import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { probeVideo } from "./probe";
import { renderFrames } from "./frameRenderer";
import { encodeVideo } from "./encode";
import type {
  SubtitleLine,
  SubtitleStyle,
  SubtitlePosition,
  AnimationConfig,
} from "@captionly/engine";

type SubtitleJSON = {
  lines: SubtitleLine[];
  style: SubtitleStyle;
  position: SubtitlePosition;
  animation: AnimationConfig;
};

const INPUT_VIDEO = resolve(import.meta.dir, "../files/input.mp4");
const INPUT_SUBTITLES = resolve(import.meta.dir, "../files/subtitles.json");
const OUTPUT_VIDEO = resolve(import.meta.dir, "../output/output.mp4");

mkdirSync(resolve(import.meta.dir, "../output"), { recursive: true });

console.log("Loading subtitles…");
const { lines, style, position, animation } = JSON.parse(
  readFileSync(INPUT_SUBTITLES, "utf-8"),
) as SubtitleJSON;

console.log("Probing video…");
const { fps, duration, width, height } = await probeVideo(INPUT_VIDEO);
const totalFrames = Math.ceil(duration * fps);
console.log(
  `  ${width}×${height} @ ${fps.toFixed(2)} fps — ${duration.toFixed(2)}s — ${totalFrames} frames`,
);

console.log("Rendering subtitle overlay + encoding…");
const frames = renderFrames(lines, style, position, animation, fps, duration);
await encodeVideo(INPUT_VIDEO, OUTPUT_VIDEO, fps, frames, totalFrames);

console.log(`Done → ${OUTPUT_VIDEO}`);
