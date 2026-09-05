import React, { useState } from "react";
import {
  Download,
  Film,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Zap,
  HardDrive,
  Server as ServerIcon,
} from "lucide-react";
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
import { useServerVideoExport } from "./useServerVideoExport";
import { downloadBlob } from "./downloadBlob";
import type { SubtitleExportData } from "./types";
import type { VideoMeta } from "@/store/types";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  video: VideoMeta;
  subtitles: SubtitleExportData;
}

export function ExportDialog({ open, onOpenChange, video, subtitles }: ExportDialogProps) {
  const [mode, setMode] = useState<"client" | "server">("client");

  const {
    isSupported,
    isExporting: clientIsExporting,
    progress,
    error: clientError,
    exportVideo: clientExportVideo,
    cancelExport: clientCancelExport,
  }: UseVideoExportReturn = useVideoExport();

  const serverExport = useServerVideoExport();

  const isExporting = mode === "client" ? clientIsExporting : serverExport.isExporting;
  const error = mode === "client" ? clientError : serverExport.error;
  const cancelExport = mode === "client" ? clientCancelExport : serverExport.cancelExport;

  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);

  const handleStartExport = async () => {
    setExportedBlob(null);

    const source = video.file ?? video.src;

    try {
      const blob =
        mode === "client"
          ? await clientExportVideo(source, subtitles)
          : await serverExport.exportVideo(source, subtitles);
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
  const clientBlocked = mode === "client" && !isSupported;

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
                {mode === "client"
                  ? "Zero-backend, hardware-accelerated in-browser render"
                  : "Uploads to a render service and returns the finished file"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isExporting ? (
          mode === "client" ? (
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
          ) : (
            <div className="space-y-4 py-6 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {serverExport.phase === "uploading" ? "Uploading video…" : "Rendering on server…"}
                </p>
                <p className="text-xs text-muted-foreground">
                  This may take a moment depending on video length.
                </p>
              </div>
            </div>
          )
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

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("client")}
                className={`rounded-md border px-3 py-2 text-xs font-medium transition ${
                  mode === "client"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                Client
              </button>
              <button
                type="button"
                onClick={() => setMode("server")}
                className={`rounded-md border px-3 py-2 text-xs font-medium transition ${
                  mode === "server"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                Server
              </button>
            </div>

            {clientBlocked ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">WebCodecs not supported</p>
                  <p className="mt-1 text-muted-foreground">
                    Your current browser does not support the WebCodecs API. Please use Google
                    Chrome, Microsoft Edge, or Safari 16.4+, or switch to Server export above.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-secondary/40 p-3 text-xs space-y-1.5 text-muted-foreground">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  {mode === "client" ? (
                    <HardDrive className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <ServerIcon className="h-3.5 w-3.5 text-primary" />
                  )}
                  <span>
                    {mode === "client" ? "Client-Side Fast Export" : "Server-Side Export"}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {mode === "client"
                    ? "Video frames and subtitle animations are rendered directly in your browser via WebCodecs. No video is uploaded to external servers."
                    : "Your video is uploaded temporarily to a render service, processed there, and the finished file is sent back to you."}
                </p>
              </div>
            )}
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
                disabled={clientBlocked}
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
