import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Plus, Trash2 } from "lucide-react";
import { useCreateProject, useDeleteProject, useProjects } from "@/api/projects";
import type { Project } from "@/api/types";
import { signOut } from "@/auth/authClient";
import { formatTimecode } from "@/lib/timecode";
import { NewProjectDialog } from "./NewProjectDialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ProjectDashboard() {
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const handleCreate = (name: string) => {
    createProject.mutate(name, {
      onSuccess: (project) => {
        setDialogOpen(false);
        navigate({ to: "/projects/$projectId", params: { projectId: project.id } });
      },
    });
  };

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-10 text-ink">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Your projects</h1>
        <button
          onClick={() => void signOut()}
          className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>

      <button
        onClick={() => setDialogOpen(true)}
        className="mt-6 flex items-center gap-2 rounded-md bg-edit px-3 py-1.5 text-xs
                   font-semibold text-void transition-transform hover:scale-[1.02]
                   active:scale-95 disabled:pointer-events-none disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
        New project
      </button>

      <NewProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={handleCreate}
        isCreating={createProject.isPending}
      />

      <div className="mt-6 divide-y divide-hairline rounded-md border border-hairline">
        {isLoading && <div className="p-4 text-sm text-ink-muted">Loading…</div>}
        {!isLoading && projects?.length === 0 && (
          <div className="p-4 text-sm text-ink-muted">No projects yet.</div>
        )}
        {projects?.map((project) => (
          <div key={project.id} className="flex items-center justify-between gap-4 p-4">
            <button
              onClick={() =>
                navigate({ to: "/projects/$projectId", params: { projectId: project.id } })
              }
              className="flex-1 text-left"
            >
              <div className="text-sm font-medium">{project.name}</div>
              <div className="text-xs text-ink-muted">
                {project.videoMeta ? formatTimecode(project.videoMeta.durationSec) : "No video yet"}
              </div>
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setDeleteTarget(project)}
                  aria-label="Delete project"
                  className="grid h-8 w-8 place-items-center rounded-md text-ink-muted
                             transition-colors hover:bg-raised hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Delete project</TooltipContent>
            </Tooltip>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This permanently deletes the project, its video, and all its snapshots."
        onConfirm={() => deleteTarget && deleteProject.mutate(deleteTarget.id)}
      />
    </div>
  );
}
