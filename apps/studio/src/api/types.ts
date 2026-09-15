export interface ApiVideoMeta {
  width: number;
  height: number;
  durationSec: number;
  fps: number;
  mimeType: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  videoUrl: string | null;
  videoMeta: ApiVideoMeta | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotSummary {
  id: string;
  label: string;
  createdAt: string;
}

export interface SnapshotDetail extends SnapshotSummary {
  projectId: string;
  document: unknown;
}
