import { useRef, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import {
  sampleSubtitles,
  defaultStyle,
  defaultPosition,
  defaultAnimation,
  type SubtitleStyle,
  type SafeZonePreset,
  type AnimationConfig,
} from "@captionly/engine";
import { StylePanel } from "./StylePanel";
import { AnimationPanel } from "./AnimationPanel";
import { StudioPlayer } from "./StudioPlayer";
import { ExportDialog } from "@/export/ExportDialog";
import { Download } from "lucide-react";

const VIDEO_SRC = "/test1.mp4";
const DURATION_IN_FRAMES = 450; // 15s at 30fps
const FPS = 30;

export function SubtitleEditor() {
  const playerRef = useRef<PlayerRef | null>(null);

  const [style, setStyle] = useState<SubtitleStyle>(defaultStyle);
  const [animation, setAnimation] = useState<AnimationConfig>(defaultAnimation);
  const [position, setPosition] = useState(defaultPosition);
  const [safeZone, setSafeZone] = useState<SafeZonePreset>("none");
  const [exportOpen, setExportOpen] = useState<boolean>(false);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 w-full">
      <div className="flex flex-col gap-4 min-w-0">
        {/* Studio Remotion Video Player Viewport */}
        <StudioPlayer
          videoSrc={VIDEO_SRC}
          subtitles={{
            lines: sampleSubtitles,
            style,
            position,
            animation,
          }}
          safeZone={safeZone}
          durationInFrames={DURATION_IN_FRAMES}
          fps={FPS}
          playerRef={playerRef}
        />
      </div>

      <div className="flex flex-col gap-4">
        {/* Export Action Card */}
        <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
          <button
            onClick={() => setExportOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[hsl(45_100%_50%)] to-[hsl(15_100%_55%)] px-4 py-2.5 text-xs font-semibold text-black shadow-md hover:opacity-95 active:scale-[0.99] transition cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Export Video (In-Browser)</span>
          </button>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Fast WebCodecs render · 0 backend upload
          </p>
        </div>

        <AnimationPanel animation={animation} onChange={setAnimation} />
        <StylePanel
          style={style}
          onStyleChange={setStyle}
          safeZone={safeZone}
          onSafeZoneChange={setSafeZone}
        />
      </div>

      {/* In-Browser Video Export Modal */}
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        videoSrc={VIDEO_SRC}
        subtitles={{
          lines: sampleSubtitles,
          style,
          position,
          animation,
        }}
      />
    </div>
  );
}
