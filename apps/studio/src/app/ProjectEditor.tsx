import { useEffect, useRef } from "react";
import { useProject } from "@/api/projects";
import { useSnapshotDetail, useSnapshots } from "@/api/snapshots";
import { videoMetaFromProject, type SnapshotDocument } from "@/api/documentMapper";
import { useStudioStore } from "@/store";
import { StudioShell } from "./StudioShell";

export function ProjectEditor({ projectId }: { projectId: string }) {
  const { data: project, isLoading: projectLoading, error } = useProject(projectId);
  const { data: snapshots, isLoading: snapshotsLoading } = useSnapshots(projectId);
  const latestSnapshotId = snapshots?.[0]?.id ?? null;
  const { data: latestSnapshot } = useSnapshotDetail(projectId, latestSnapshotId);

  const setProjectId = useStudioStore((s) => s.setProjectId);
  const replaceDocument = useStudioStore((s) => s.replaceDocument);
  const resetHistory = useStudioStore((s) => s.resetHistory);
  const loadedRef = useRef<string | null>(null);

  // Waits for the snapshot list, then (if one exists) the newest snapshot's
  // full document, so a reopened project restores where it was left off
  // instead of starting blank.
  const readyToLoad = !!project && !snapshotsLoading && (!latestSnapshotId || !!latestSnapshot);

  useEffect(() => {
    if (!readyToLoad || !project || loadedRef.current === project.id) return;
    loadedRef.current = project.id;
    const document = latestSnapshot?.document as SnapshotDocument | undefined;
    const current = useStudioStore.getState();
    setProjectId(project.id);
    replaceDocument({
      video: videoMetaFromProject(project),
      lines: document?.lines ?? [],
      style: document?.style ?? current.style,
      animation: document?.animation ?? current.animation,
      position: document?.position ?? current.position,
    });
    resetHistory();
  }, [readyToLoad, project, latestSnapshot, setProjectId, replaceDocument, resetHistory]);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center text-ink-muted">Project not found.</div>
    );
  }
  if (projectLoading || !readyToLoad) {
    return <div className="grid min-h-screen place-items-center text-ink-muted">Loading…</div>;
  }

  return <StudioShell />;
}
