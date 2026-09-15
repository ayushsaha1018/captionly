import { useEffect, useRef, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import { Download, FolderOpen, LogOut, Undo2, Redo2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { useStudioStore } from "@/store";
import { ExportDialog } from "@/export/ExportDialog";
import { TranscribeModal } from "@/transcribe";
import { PlayerRail } from "./PlayerRail";
import { WorkSurface } from "./WorkSurface";
import { SaveMenu } from "./SaveMenu";
import { formatTimecode } from "@/lib/timecode";
import type { SafeZonePreset } from "@captionly/engine";
import { signOut, useSession } from "@/auth/authClient";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useProject } from "@/api/projects";

export function StudioShell() {
  const playerRef = useRef<PlayerRef | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [transcribeOpen, setTranscribeOpen] = useState(false);
  const [safeZone, setSafeZone] = useState<SafeZonePreset>("none");
  const [resolvedVideoFile, setResolvedVideoFile] = useState<File | null>(null);
  const [resolvingVideoFile, setResolvingVideoFile] = useState(false);
  const resolvedForSrc = useRef<string | null>(null);

  const { video, lines, style, animation, position } = useStudioStore(
    useShallow((s) => ({
      video: s.video,
      lines: s.lines,
      style: s.style,
      animation: s.animation,
      position: s.position,
    })),
  );
  const canUndo = useStudioStore((s) => s.past.length > 0);
  const canRedo = useStudioStore((s) => s.future.length > 0);
  const undo = useStudioStore((s) => s.undo);
  const redo = useStudioStore((s) => s.redo);
  const projectId = useStudioStore((s) => s.projectId);
  const { data: session } = useSession();
  const { data: project } = useProject(projectId ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const inTextField =
        !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        if (inTextField) return; // let text fields keep their native field-level undo
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      if ((e.key === "Backspace" || e.key === "Delete") && !inTextField) {
        const state = useStudioStore.getState();
        if (state.selectedLineId && !state.editingLineId) {
          e.preventDefault();
          state.deleteLine(state.selectedLineId);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  useEffect(() => {
    if (!video && exportOpen) {
      setExportOpen(false);
    }
  }, [video, exportOpen]);

  useEffect(() => {
    if (video?.src !== resolvedForSrc.current) {
      resolvedForSrc.current = null;
      setResolvedVideoFile(null);
    }
  }, [video?.src]);

  // A video reloaded from a project has only `src` (a URL), no in-memory `File` —
  // fetch it once and wrap it in a File so transcription works there too.
  // Reads fresh from the store (not the closured `video`) since PlayerRail can call
  // this synchronously right after loadVideo(), before this component re-renders.
  const openTranscribe = async () => {
    const video = useStudioStore.getState().video;
    if (!video) return;
    if (video.file || resolvedForSrc.current === video.src) {
      setTranscribeOpen(true);
      return;
    }
    setResolvingVideoFile(true);
    try {
      const res = await fetch(video.src);
      const blob = await res.blob();
      resolvedForSrc.current = video.src;
      setResolvedVideoFile(new File([blob], "video", { type: blob.type || "video/mp4" }));
      setTranscribeOpen(true);
    } catch {
      setTranscribeOpen(true); // TranscribeModal shows its own "no video file" warning
    } finally {
      setResolvingVideoFile(false);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-void text-ink">
      <header className="shrink-0 border-b border-hairline bg-void/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-lg font-semibold tracking-tight">Captionly</span>
            {project && <span className="text-sm text-ink-muted">{project.name}</span>}
            {video && (
              <span className="tabular text-xs text-ink-muted">
                {video.width}×{video.height} · {formatTimecode(video.durationSec)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {session && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/projects"
                    aria-label="Back to projects"
                    className="grid h-8 w-8 place-items-center rounded-md text-ink-muted
                               transition-colors hover:bg-raised hover:text-ink"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Back to projects</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  aria-label="Undo"
                  className="grid h-8 w-8 place-items-center rounded-md text-ink-muted
                             transition-colors hover:bg-raised hover:text-ink disabled:opacity-30
                             focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Undo (⌘Z)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  aria-label="Redo"
                  className="grid h-8 w-8 place-items-center rounded-md text-ink-muted
                             transition-colors hover:bg-raised hover:text-ink disabled:opacity-30
                             focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit"
                >
                  <Redo2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Redo (⌘⇧Z)</TooltipContent>
            </Tooltip>

            <button
              onClick={() => setExportOpen(true)}
              disabled={!video}
              className="flex items-center gap-2 rounded-md bg-edit px-3 py-1.5 text-xs
                         font-semibold text-void transition-transform hover:scale-[1.02]
                         active:scale-95 disabled:pointer-events-none disabled:opacity-40
                         focus-visible:outline-2 focus-visible:outline-offset-2
                         focus-visible:outline-edit"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>

            {projectId && <SaveMenu projectId={projectId} />}

            {session && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => void signOut()}
                    aria-label="Sign out"
                    className="grid h-8 w-8 place-items-center rounded-md text-ink-muted
                               transition-colors hover:bg-raised hover:text-ink"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Sign out</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 gap-8 px-6 py-6">
        <PlayerRail
          playerRef={playerRef}
          safeZone={safeZone}
          onSafeZoneChange={setSafeZone}
          onOpenTranscribe={openTranscribe}
        />
        <WorkSurface
          playerRef={playerRef}
          onOpenTranscribe={openTranscribe}
          isPreparingTranscribe={resolvingVideoFile}
        />
      </div>

      {video && (
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          video={video}
          subtitles={{ lines, style, position, animation }}
        />
      )}

      <TranscribeModal
        open={transcribeOpen}
        onOpenChange={setTranscribeOpen}
        videoFile={video?.file ?? resolvedVideoFile}
      />
    </div>
  );
}
