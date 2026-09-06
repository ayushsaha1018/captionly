import React, { useEffect, useState } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  HardDriveDownload,
  Cpu,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useStudioStore } from "@/store";
import {
  checkWebGpuSupport,
  checkModelCached,
  runTranscriptionPipeline,
} from "./transcribeService";
import {
  MODEL_OPTIONS,
  PACING_CONFIG,
  type WhisperModelOption,
  type PacingOption,
  type TranscribeProgress,
} from "./types";

interface TranscribeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoFile?: File | null;
  onComplete?: () => void;
}

export function TranscribeModal({
  open,
  onOpenChange,
  videoFile,
  onComplete,
}: TranscribeModalProps) {
  const setLines = useStudioStore((s) => s.setLines);

  const [model, setModel] = useState<WhisperModelOption>("base.en");
  const [pacing, setPacing] = useState<PacingOption>("reel");
  const [isCached, setIsCached] = useState<boolean>(false);
  const [webGpuStatus, setWebGpuStatus] = useState<{
    checked: boolean;
    supported: boolean;
    reason?: string;
  }>({ checked: false, supported: true });

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState<TranscribeProgress>({ stage: "idle" });
  const [error, setError] = useState<string | null>(null);

  // Check WebGPU compatibility and model caching on open/model change
  useEffect(() => {
    if (!open) {
      setError(null);
      setProgress({ stage: "idle" });
      setIsTranscribing(false);
      return;
    }

    let isMounted = true;

    async function checkEnvironment() {
      const gpu = await checkWebGpuSupport();
      if (!isMounted) return;
      setWebGpuStatus({ checked: true, supported: gpu.supported, reason: gpu.reason });

      if (gpu.supported) {
        const cached = await checkModelCached(model);
        if (isMounted) setIsCached(cached);
      }
    }

    checkEnvironment();

    return () => {
      isMounted = false;
    };
  }, [open, model]);

  const handleStartTranscribe = async () => {
    if (!videoFile) {
      toast.error("No video file loaded for transcription.");
      return;
    }

    setIsTranscribing(true);
    setError(null);
    setProgress({ stage: "extracting-audio" });

    try {
      const generatedLines = await runTranscriptionPipeline({
        file: videoFile,
        model,
        pacing,
        onProgress: (p) => setProgress(p),
      });

      setLines(generatedLines);

      if (generatedLines.length === 0) {
        toast.info("No speech was detected in this video.");
      } else {
        toast.success(
          `Auto-transcribed ${generatedLines.length} caption ${generatedLines.length === 1 ? "line" : "lines"}!`,
        );
      }

      onComplete?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to transcribe video";
      setError(message);
      setProgress({ stage: "error", error: message });
      toast.error(message);
    } finally {
      setIsTranscribing(false);
    }
  };

  const getStatusLabel = () => {
    switch (progress.stage) {
      case "extracting-audio":
        return "Extracting audio track...";
      case "downloading-model": {
        const pct =
          progress.modelProgress !== undefined
            ? ` (${Math.round(progress.modelProgress * 100)}%)`
            : "";
        return `Downloading Whisper model${pct}...`;
      }
      case "transcribing":
        return "Transcribing speech with WebGPU...";
      default:
        return "Processing...";
    }
  };

  const percent =
    progress.stage === "downloading-model" && progress.modelProgress !== undefined
      ? Math.round(progress.modelProgress * 100)
      : progress.stage === "transcribing"
        ? 90
        : progress.stage === "extracting-audio"
          ? 15
          : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => (!isTranscribing ? onOpenChange(v) : null)}>
      <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-zinc-100">
                Auto-Transcribe Video
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-zinc-400">
            Generate synchronized subtitles directly in your browser using local Whisper AI on
            WebGPU.
          </DialogDescription>
        </DialogHeader>

        {/* WebGPU Warning */}
        {webGpuStatus.checked && !webGpuStatus.supported && (
          <Alert variant="destructive" className="bg-red-950/40 border-red-900/50 text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <AlertTitle className="text-xs font-semibold">WebGPU Unsupported</AlertTitle>
            <AlertDescription className="text-xs text-red-300/90 mt-1">
              {webGpuStatus.reason ||
                "In-browser transcription requires WebGPU. Please use Google Chrome, Microsoft Edge, or a compatible browser."}
            </AlertDescription>
          </Alert>
        )}

        {/* No File Warning */}
        {!videoFile && (
          <Alert className="bg-amber-950/30 border-amber-900/40 text-amber-300">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <AlertTitle className="text-xs font-semibold">No Video File</AlertTitle>
            <AlertDescription className="text-xs text-amber-300/80 mt-1">
              Please drop or select a video file in the studio first.
            </AlertDescription>
          </Alert>
        )}

        {/* Configuration Selectors */}
        <div className="space-y-4 py-2">
          {/* Model Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                Whisper AI Model
              </label>
              {isCached && (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono"
                >
                  <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                  Cached
                </Badge>
              )}
            </div>
            <Select
              value={model}
              onValueChange={(val) => setModel(val as WhisperModelOption)}
              disabled={isTranscribing || !webGpuStatus.supported}
            >
              <SelectTrigger className="w-full bg-zinc-900/80 border-zinc-800 text-xs h-9">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                {MODEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id} className="text-xs">
                    <span className="font-medium">{opt.name}</span>{" "}
                    <span className="text-zinc-500">({opt.sizeEstimate})</span>
                    {opt.recommended && (
                      <span className="ml-1.5 text-emerald-400 text-[10px] font-mono">
                        [Recommended]
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pacing Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Subtitle Pacing</label>
            <Select
              value={pacing}
              onValueChange={(val) => setPacing(val as PacingOption)}
              disabled={isTranscribing || !webGpuStatus.supported}
            >
              <SelectTrigger className="w-full bg-zinc-900/80 border-zinc-800 text-xs h-9">
                <SelectValue placeholder="Select pacing" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                <SelectItem value="reel" className="text-xs">
                  <div className="font-medium">{PACING_CONFIG.reel.label}</div>
                  <div className="text-[10px] text-zinc-500">{PACING_CONFIG.reel.description}</div>
                </SelectItem>
                <SelectItem value="standard" className="text-xs">
                  <div className="font-medium">{PACING_CONFIG.standard.label}</div>
                  <div className="text-[10px] text-zinc-500">
                    {PACING_CONFIG.standard.description}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Progress & Status */}
        {isTranscribing && (
          <div className="space-y-2 py-3 px-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                {getStatusLabel()}
              </span>
              <span className="text-zinc-500 font-mono text-[11px]">{percent}%</span>
            </div>
            <Progress value={percent} className="h-1.5 bg-zinc-800" />
            <p className="text-[10px] text-zinc-500">
              Runs 100% in your browser using WebGPU. No video or audio leaves your computer.
            </p>
          </div>
        )}

        {/* Error Feedback */}
        {error && (
          <Alert variant="destructive" className="bg-red-950/40 border-red-900/50 text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <AlertTitle className="text-xs font-semibold">Transcription Failed</AlertTitle>
            <AlertDescription className="text-xs text-red-300/90 mt-1">{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isTranscribing}
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            Skip
          </Button>

          {error ? (
            <Button
              size="sm"
              onClick={handleStartTranscribe}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Try Again
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleStartTranscribe}
              disabled={isTranscribing || !videoFile || !webGpuStatus.supported}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              {isTranscribing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Transcribing...
                </>
              ) : isCached ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Transcribe
                </>
              ) : (
                <>
                  <HardDriveDownload className="w-3.5 h-3.5 mr-1.5" />
                  Download & Transcribe
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
