import React from "react";
import { registerRoot, Composition } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import {
  MainComposition,
  sampleSubtitles,
  defaultStyle,
  defaultPosition,
  defaultAnimation,
} from "@captionly/engine";

loadFont("normal", {
  weights: ["400", "600", "700", "900"],
  subsets: ["latin"],
});

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MainComposition"
      component={MainComposition as React.FC<any>}
      durationInFrames={450}
      fps={30}
      width={1920}
      height={1080}
      calculateMetadata={({ props }: { props: any }) => {
        return {
          width: props?.width ?? 1920,
          height: props?.height ?? 1080,
          fps: props?.fps ?? 30,
          durationInFrames: props?.durationInFrames ?? 450,
        };
      }}
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
