import React from "react";
import { registerRoot, Composition } from "remotion";
import {
  MainComposition,
  sampleSubtitles,
  defaultStyle,
  defaultPosition,
  defaultAnimation,
} from "@captionly/engine";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MainComposition"
      component={MainComposition as React.FC<any>}
      durationInFrames={450}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        videoSrc: "",
        subtitles: {
          lines: sampleSubtitles,
          style: defaultStyle,
          position: defaultPosition,
          animation: defaultAnimation,
        },
      }}
    />
  );
};

registerRoot(RemotionRoot);
