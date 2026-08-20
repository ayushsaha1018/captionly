import React, { useState } from "react";
import { Download, Film, Loader2, CheckCircle2, AlertCircle, Zap, HardDrive } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useVideoExport, type UseVideoExportReturn } from "./useVideoExport";
import type { SubtitleExportData, ExportOptions } from "./types";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoSrc: string;
  subtitles: SubtitleExportData;
}

export function ExportDialog({ open, onOpenChange, videoSrc, subtitles }: ExportDialogProps) {
  const {
    isSupported,
    isExporting,
    progress,
    error,
    exportVideo,
    cancelExport,
    downloadBlob,
  }: UseVideoExportReturn = useVideoExport();

  const [fps, setFps] = useState<number>(60);
  const [quality, setQuality] = useState<"standard" | "high" | "ultra">("high");
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);

  const handleStartExport = async () => {
    setExportedBlob(null);
    const bitrate = quality === "ultra" ? 18_000_000 : quality === "high" ? 12_000_000 : 8_000_000;

    const options: ExportOptions = {
      fps,
      bitrate,
    };

    try {
      const blob = await exportVideo(videoSrc, subtitles, options);
      if (blob) {
        setExportedBlob(blob);
      }
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const handleDownload = () => {
    if (exportedBlob) {
      downloadBlob(exportedBlob, `captionly-export-${Date.now()}.mp4`);
    }
  };

  const handleClose = (newOpen: boolean) => {
    if (isExporting && !newOpen) {
      if (confirm("Cancel in-progress video export?")) {
        cancelExport();
        onOpenChange(false);
      }
    } else {
      onOpenChange(newOpen);
    }
  };

  const percent = Math.round((progress?.progress ?? 0) * 100);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Export Video with Subtitles
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Zero-backend, hardware-accelerated in-browser render
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!isSupported ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">WebCodecs not supported</p>
              <p className="mt-1 text-muted-foreground">
                Your current browser does not support the WebCodecs API. Please use Google Chrome,
                Microsoft Edge, or Safari 16.4+.
              </p>
            </div>
          </div>
        ) : isExporting ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="capitalize text-foreground">
                  {progress?.phase === "demuxing"
                    ? "Demuxing Video Tracks..."
                    : progress?.phase === "rendering"
                      ? "Compositing Subtitles & Encoding..."
                      : progress?.phase === "muxing"
                        ? "Finalizing MP4 Container..."
                        : "Processing..."}
                </span>
                <span className="tabular-nums font-semibold text-primary">{percent}%</span>
              </div>
              <Progress value={percent} className="h-2" />
            </div>

            {/* Performance & Progress Stats */}
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-secondary/30 p-2.5 text-center text-xs">
              <div>
                <p className="text-[10px] text-muted-foreground">Render Speed</p>
                <p className="font-semibold tabular-nums text-foreground mt-0.5">
                  {progress?.fps ? `${progress.fps} fps` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Frames</p>
                <p className="font-semibold tabular-nums text-foreground mt-0.5">
                  {progress?.totalFrames
                    ? `${progress.currentFrame} / ${progress.totalFrames}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Est. Remaining</p>
                <p className="font-semibold tabular-nums text-foreground mt-0.5">
                  {progress?.estimatedRemainingSec !== undefined
                    ? `${progress.estimatedRemainingSec}s`
                    : "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground justify-center">
              <Zap className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
              <span>Rendering on local GPU Web Worker</span>
            </div>
          </div>
        ) : exportedBlob ? (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Export Complete!</h3>
              <p className="text-xs text-muted-foreground">
                Size: {(exportedBlob.size / (1024 * 1024)).toFixed(2)} MB · H.264 MP4
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Export Settings */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Frame Rate</label>
                <select
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
                >
                  <option value={60}>60 FPS (Ultra Smooth)</option>
                  <option value={30}>30 FPS (Standard)</option>
                  <option value={24}>24 FPS (Cinematic)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Quality Preset</label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as "standard" | "high" | "ultra")}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
                >
                  <option value="high">High (12 Mbps)</option>
                  <option value="ultra">Ultra (18 Mbps)</option>
                  <option value="standard">Standard (8 Mbps)</option>
                </select>
              </div>
            </div>

            <div className="rounded-lg bg-secondary/40 p-3 text-xs space-y-1.5 text-muted-foreground">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <HardDrive className="h-3.5 w-3.5 text-primary" />
                <span>Client-Side Fast Export</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Video frames and subtitle animations are rendered directly in your browser via
                WebCodecs. No video is uploaded to external servers.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {isExporting ? (
            <button
              onClick={cancelExport}
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-xs font-medium text-foreground shadow-sm hover:bg-accent transition"
            >
              Cancel
            </button>
          ) : exportedBlob ? (
            <div className="flex w-full gap-2 justify-end">
              <button
                onClick={() => setExportedBlob(null)}
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-xs font-medium text-foreground shadow-sm hover:bg-accent transition"
              >
                Export Again
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition"
              >
                <Download className="h-4 w-4" />
                Download MP4
              </button>
            </div>
          ) : (
            <div className="flex w-full gap-2 justify-end">
              <button
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-xs font-medium text-foreground shadow-sm hover:bg-accent transition"
              >
                Close
              </button>
              <button
                onClick={handleStartExport}
                disabled={!isSupported}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition disabled:opacity-50 disabled:pointer-events-none"
              >
                <Zap className="h-4 w-4" />
                Start Export
              </button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
