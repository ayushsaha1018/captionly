import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
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

console.log("Bundling Remotion composition…");
const bundleLocation = await bundle({
  entryPoint: resolve(import.meta.dir, "remotionRoot.tsx"),
});

const inputProps = {
  videoSrc: INPUT_VIDEO,
  subtitles: {
    lines,
    style,
    position,
    animation,
  },
};

const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: "MainComposition",
  inputProps,
});

console.log("Rendering Remotion video…");
await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: "h264",
  outputLocation: OUTPUT_VIDEO,
  inputProps,
  licenseKey: "free-license",
  onProgress: ({ progress, renderedFrames }) => {
    process.stdout.write(
      `\rRendering: ${Math.round(progress * 100)}% (${renderedFrames} frames)`,
    );
  },
});

console.log(`\nDone → ${OUTPUT_VIDEO}`);
