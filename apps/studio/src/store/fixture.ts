import {
  sampleSubtitles,
  defaultStyle,
  defaultPosition,
  defaultAnimation,
} from "@captionly/engine";
import type { DocumentSnapshot } from "./types";

/**
 * Sub-project 1 seed. Upload lands in sub-project 2, but PlayerRail's transport,
 * LineList's trailing affordance, and <Player durationInFrames> all need a
 * duration before then.
 *
 * DELETE THIS FILE in sub-project 2, when real metadata arrives from
 * the video element's `loadedmetadata` event.
 */
export const SP1_FIXTURE: DocumentSnapshot = {
  video: { src: "/test1.mp4", durationSec: 15, width: 1920, height: 1080 },
  lines: sampleSubtitles,
  style: defaultStyle,
  animation: defaultAnimation,
  position: defaultPosition,
};
