import type {
  AnimationConfig,
  SubtitleLine,
  SubtitlePosition,
  SubtitleStyle,
} from "@captionly/engine";
import type { DocumentSnapshot, VideoMeta } from "@/store/types";
import type { Project } from "./types";

export interface SnapshotDocument {
  lines: SubtitleLine[];
  style: SubtitleStyle;
  animation: AnimationConfig;
  position: SubtitlePosition;
}

export function toDocumentPayload(doc: DocumentSnapshot): SnapshotDocument {
  return { lines: doc.lines, style: doc.style, animation: doc.animation, position: doc.position };
}

export function videoMetaFromProject(project: Project): VideoMeta | null {
  if (!project.videoUrl || !project.videoMeta) return null;
  return {
    src: project.videoUrl,
    width: project.videoMeta.width,
    height: project.videoMeta.height,
    durationSec: project.videoMeta.durationSec,
  };
}
