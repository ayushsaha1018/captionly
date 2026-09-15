import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { SnapshotDetail, SnapshotSummary } from "./types";

const snapshotsKey = (projectId: string) => ["projects", projectId, "snapshots"] as const;

export function useSnapshots(projectId: string) {
  return useQuery({
    queryKey: snapshotsKey(projectId),
    queryFn: () => apiFetch<SnapshotSummary[]>(`/projects/${projectId}/snapshots`),
    enabled: !!projectId,
  });
}

export function useCreateSnapshot(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { label: string; document: unknown }) =>
      apiFetch<SnapshotSummary>(`/projects/${projectId}/snapshots`, {
        method: "POST",
        body: JSON.stringify(params),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: snapshotsKey(projectId) }),
  });
}

export function useSnapshotDetail(projectId: string, snapshotId: string | null) {
  return useQuery({
    queryKey: [...snapshotsKey(projectId), snapshotId],
    queryFn: () => apiFetch<SnapshotDetail>(`/projects/${projectId}/snapshots/${snapshotId}`),
    enabled: !!projectId && !!snapshotId,
  });
}

export function useDeleteSnapshot(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (snapshotId: string) =>
      apiFetch<void>(`/projects/${projectId}/snapshots/${snapshotId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: snapshotsKey(projectId) }),
  });
}
