import { useEffect, useRef, useState } from "react";
import { fabric } from "fabric";
import {
  SubtitleRenderer,
  CANVAS_W,
  CANVAS_H,
  sampleSubtitles,
  defaultStyle,
  defaultPosition,
  defaultAnimation,
  type SubtitleStyle,
  type SafeZonePreset,
  type AnimationConfig,
} from "@captionly/engine";
import { SafeZones } from "./SafeZones";
import { StylePanel } from "./StylePanel";
import { AnimationPanel } from "./AnimationPanel";
import { StudioPlayer } from "./StudioPlayer";
import { VideoControls } from "./VideoControls";
import { useStudioPlayer } from "./useStudioPlayer";
import { ExportDialog } from "@/export/ExportDialog";
import { Download, Film, Sparkles } from "lucide-react";

const VIDEO_SRC = "/test1.mp4";

export function SubtitleEditor() {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const rendererRef = useRef<SubtitleRenderer | null>(null);
  const rafRef = useRef<number | null>(null);

  const [style, setStyle] = useState<SubtitleStyle>(defaultStyle);
  const [animation, setAnimation] = useState<AnimationConfig>(defaultAnimation);
  const [position, setPosition] = useState(defaultPosition);
  const [safeZone, setSafeZone] = useState<SafeZonePreset>("none");
  const [exportOpen, setExportOpen] = useState<boolean>(false);

  // Dedicated declarative video player controller
  const player = useStudioPlayer({
    src: VIDEO_SRC,
  });

  // Initialize Fabric canvas & SubtitleRenderer
  useEffect(() => {
    if (!canvasElRef.current) return;
    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundColor: "rgba(0,0,0,0)",
      selection: false,
      preserveObjectStacking: true,
    });
    fabricRef.current = canvas;

    const wrapper = canvasElRef.current.parentElement as HTMLElement | null;
    if (wrapper) {
      wrapper.style.width = "100%";
      wrapper.style.height = "100%";
      wrapper.style.position = "absolute";
      wrapper.style.inset = "0";
    }
    const lower = wrapper?.querySelector("canvas.lower-canvas") as HTMLCanvasElement | null;
    const upper = wrapper?.querySelector("canvas.upper-canvas") as HTMLCanvasElement | null;
    [lower, upper].forEach((c) => {
      if (!c) return;
      c.style.width = "100%";
      c.style.height = "100%";
    });

    rendererRef.current = new SubtitleRenderer(
      canvas,
      sampleSubtitles,
      defaultStyle,
      defaultPosition,
      defaultAnimation,
    );

    return () => {
      rendererRef.current?.dispose();
      canvas.dispose();
      fabricRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  // Update style and animation dynamically
  useEffect(() => {
    rendererRef.current?.setStyle(style);
  }, [style]);

  useEffect(() => {
    rendererRef.current?.setAnimation(animation);
  }, [animation]);

  // High-frequency 60fps subtitle render loop
  useEffect(() => {
    const tick = () => {
      const video = player.videoRef.current;
      const renderer = rendererRef.current;
      if (video && renderer) {
        renderer.render(video.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [player.videoRef]);

  // Sync canvas immediately on seek/scrub when paused
  useEffect(() => {
    rendererRef.current?.render(player.currentTime);
  }, [player.currentTime]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 w-full">
      <div className="flex flex-col gap-4 min-w-0">
        {/* Studio Video Player Viewport */}
        <StudioPlayer player={player} src={VIDEO_SRC}>
          <div
            className="absolute inset-0 z-10 pointer-events-none"
            style={{ aspectRatio: "16 / 9" }}
          >
            <canvas
              ref={canvasElRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="h-full w-full"
              style={{ width: "100%", height: "100%" }}
            />
          </div>
          <SafeZones preset={safeZone} />
        </StudioPlayer>

        {/* Custom Video Controls */}
        <VideoControls player={player} />
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
