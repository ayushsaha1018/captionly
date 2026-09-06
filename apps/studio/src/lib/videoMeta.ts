import type { VideoMeta } from "@/store/types";

const SUPPORTED_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export function isValidVideoType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.has(mimeType.toLowerCase());
}

/**
 * Reads video duration, width, and height via an offscreen video element.
 */
export async function extractVideoMetadata(fileOrUrl: File | string): Promise<VideoMeta> {
  if (typeof document === "undefined") {
    throw new Error("extractVideoMetadata is only supported in browser environments.");
  }

  return new Promise((resolve, reject) => {
    const isFile = typeof fileOrUrl !== "string";
    if (isFile && fileOrUrl.type && !isValidVideoType(fileOrUrl.type)) {
      reject(
        new Error(
          `Unsupported video format (${fileOrUrl.type}). Please provide an MP4, WebM, or MOV file.`,
        ),
      );
      return;
    }

    const src = isFile ? URL.createObjectURL(fileOrUrl) : fileOrUrl;
    const video = document.createElement("video");
    video.preload = "metadata";

    // 10-second watchdog timeout for corrupt or stalled media
    const timer = setTimeout(() => {
      cleanup();
      if (isFile) URL.revokeObjectURL(src);
      reject(
        new Error("Timed out reading video metadata. Please ensure the file is a valid video."),
      );
    }, 10000);

    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
      video.removeAttribute("src");
      video.load();
    };

    const onLoaded = () => {
      const durationSec = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      cleanup();

      if (!Number.isFinite(durationSec) || durationSec <= 0 || !width || !height) {
        if (isFile) URL.revokeObjectURL(src);
        reject(new Error("Invalid video dimensions or duration."));
        return;
      }

      resolve({
        src,
        durationSec,
        width,
        height,
        file: isFile ? fileOrUrl : undefined,
        isDemo: !isFile,
      } as VideoMeta);
    };

    const onError = () => {
      cleanup();
      if (isFile) URL.revokeObjectURL(src);
      reject(new Error("Unable to decode video. Format may not be supported by this browser."));
    };

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("error", onError);
    video.src = src;
  });
}
