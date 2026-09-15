import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { ApiVideoMeta, Project } from "./types";

const projectsKey = ["projects"] as const;
const projectKey = (id: string) => ["projects", id] as const;

export function useProjects() {
  return useQuery({
    queryKey: projectsKey,
    queryFn: () => apiFetch<Project[]>("/projects"),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKey(id),
    queryFn: () => apiFetch<Project>(`/projects/${id}`),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<Project>("/projects", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
  });
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: { name?: string; videoUrl?: string; videoMeta?: ApiVideoMeta | null }) =>
      apiFetch<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: (project) => {
      queryClient.setQueryData(projectKey(id), project);
      queryClient.invalidateQueries({ queryKey: projectsKey });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
  });
}

export function useRequestVideoUploadUrl(id: string) {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ uploadUrl: string; videoUrl: string }>(`/projects/${id}/video-upload-url`, {
        method: "POST",
      }),
  });
}

export function putVideoFile(
  uploadUrl: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  // fetch() has no upload-progress event; XMLHttpRequest is the native way to get one.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Video upload failed with ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Video upload failed"));
    xhr.send(file);
  });
}
