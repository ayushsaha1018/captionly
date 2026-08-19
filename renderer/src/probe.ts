export type VideoInfo = {
  fps: number;
  duration: number;
  width: number;
  height: number;
};

export async function probeVideo(path: string): Promise<VideoInfo> {
  const result =
    await Bun.$`ffprobe -v quiet -print_format json -show_streams ${path}`.json();

  const stream = (result.streams as Array<Record<string, unknown>>).find(
    (s) => s["codec_type"] === "video",
  );
  if (!stream) throw new Error(`No video stream found in ${path}`);

  const fpsRaw = (stream["r_frame_rate"] as string) ?? "30/1";
  const [num, den] = fpsRaw.split("/").map(Number);
  const fps = (num ?? 30) / (den ?? 1);

  return {
    fps,
    duration: parseFloat(stream["duration"] as string),
    width: stream["width"] as number,
    height: stream["height"] as number,
  };
}
