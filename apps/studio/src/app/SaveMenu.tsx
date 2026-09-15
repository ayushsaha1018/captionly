import { useEffect, useState } from "react";
import { Save, History, Trash2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useStudioStore } from "@/store";
import {
  useCreateSnapshot,
  useDeleteSnapshot,
  useSnapshotDetail,
  useSnapshots,
} from "@/api/snapshots";
import { toDocumentPayload } from "@/api/documentMapper";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function SaveMenu({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const doc = useStudioStore(
    useShallow((s) => ({
      lines: s.lines,
      style: s.style,
      animation: s.animation,
      position: s.position,
      video: s.video,
    })),
  );
  const dirty = useStudioStore((s) => s.dirty);
  const markSaved = useStudioStore((s) => s.markSaved);
  const replaceDocument = useStudioStore((s) => s.replaceDocument);
  const resetHistory = useStudioStore((s) => s.resetHistory);

  const { data: snapshots, isLoading } = useSnapshots(projectId);
  const createSnapshot = useCreateSnapshot(projectId);
  const deleteSnapshot = useDeleteSnapshot(projectId);
  const { data: detail } = useSnapshotDetail(projectId, restoringId);

  useEffect(() => {
    if (!detail || !restoringId) return;
    const document = detail.document as ReturnType<typeof toDocumentPayload>;
    replaceDocument({ ...document, video: doc.video });
    resetHistory();
    setRestoringId(null);
    setOpen(false);
    // doc.video intentionally omitted: only re-run when the fetched snapshot changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, restoringId, replaceDocument, resetHistory]);

  const handleSave = () => {
    createSnapshot.mutate(
      { label: new Date().toLocaleString(), document: toDocumentPayload(doc) },
      { onSuccess: () => markSaved() },
    );
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSave}
        disabled={createSnapshot.isPending}
        className="flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-xs
                   font-medium text-ink transition-colors hover:bg-raised disabled:opacity-50"
      >
        <Save className="h-3.5 w-3.5" />
        {dirty ? "Save" : "Saved"}
      </button>

      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                aria-label="Version history"
                className="grid h-8 w-8 place-items-center rounded-md text-ink-muted transition-colors hover:bg-raised hover:text-ink"
              >
                <History className="h-4 w-4" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Version history</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="w-80 p-2">
          <div className="px-2 py-1 text-xs font-medium text-ink-muted">Snapshots</div>
          {isLoading && <div className="px-2 py-2 text-xs text-ink-muted">Loading…</div>}
          {!isLoading && snapshots?.length === 0 && (
            <div className="px-2 py-2 text-xs text-ink-muted">No snapshots yet.</div>
          )}
          <div className="max-h-64 overflow-y-auto">
            {snapshots?.map((snap) => (
              <div
                key={snap.id}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-raised"
              >
                <button
                  onClick={() => setRestoringId(snap.id)}
                  className="flex-1 text-left text-xs text-ink"
                >
                  {snap.label}
                </button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => deleteSnapshot.mutate(snap.id)}
                      aria-label="Delete snapshot"
                      className="grid h-6 w-6 place-items-center rounded text-ink-muted hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Delete snapshot</TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
