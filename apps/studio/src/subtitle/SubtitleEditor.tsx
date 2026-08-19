import { useEffect, useRef, useState, useCallback } from "react";
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
} from "engine";
import { SafeZones } from "./SafeZones";
import { StylePanel } from "./StylePanel";
import { AnimationPanel } from "./AnimationPanel";
import { VideoControls } from "./VideoControls";

const VIDEO_SRC = "https://videos.pexels.com/video-files/37233052/15773739_1920_1080_25fps.mp4";

export function SubtitleEditor() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const rendererRef = useRef<SubtitleRenderer | null>(null);
  const rafRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [style, setStyle] = useState<SubtitleStyle>(defaultStyle);
  const [animation, setAnimation] = useState<AnimationConfig>(defaultAnimation);
  const [safeZone, setSafeZone] = useState<SafeZonePreset>("none");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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

  useEffect(() => {
    rendererRef.current?.setStyle(style);
  }, [style]);

  useEffect(() => {
    rendererRef.current?.setAnimation(animation);
  }, [animation]);

  useEffect(() => {
    const tick = () => {
      const v = videoRef.current;
      const r = rendererRef.current;
      if (v && r) {
        r.render(v.currentTime);
        setCurrentTime(v.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onMeta = () => setDuration(v.duration);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("loadedmetadata", onMeta);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  const handlePlayPause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }, []);
  const handleSeek = useCallback((t: number) => {
    if (videoRef.current) videoRef.current.currentTime = t;
  }, []);
  const handleVolume = useCallback((v: number) => {
    if (videoRef.current) videoRef.current.volume = v;
  }, []);
  const handleRate = useCallback((r: number) => {
    if (videoRef.current) videoRef.current.playbackRate = r;
  }, []);
  const handleFullscreen = useCallback(() => {
    containerRef.current?.requestFullscreen?.();
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 w-full">
      <div className="flex flex-col gap-4 min-w-0">
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10"
          style={{ aspectRatio: "16 / 9" }}
        >
          <video
            ref={videoRef}
            src={VIDEO_SRC}
            playsInline
            muted
            preload="auto"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 z-10" style={{ aspectRatio: "16 / 9" }}>
            <canvas
              ref={canvasElRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="h-full w-full"
              style={{ width: "100%", height: "100%" }}
            />
          </div>
          <SafeZones preset={safeZone} />
        </div>

        <VideoControls
          playing={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          onVolume={handleVolume}
          onRate={handleRate}
          onFullscreen={handleFullscreen}
        />
      </div>

      <div className="flex flex-col gap-4">
        <AnimationPanel animation={animation} onChange={setAnimation} />
        <StylePanel
          style={style}
          onStyleChange={setStyle}
          safeZone={safeZone}
          onSafeZoneChange={setSafeZone}
        />
      </div>
    </div>
  );
}
