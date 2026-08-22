export async function encodeVideo(
  inputPath: string,
  outputPath: string,
  fps: number,
  width: number,
  height: number,
  frameGen: AsyncGenerator<Buffer>,
  totalFrames: number,
  onProgress: (frame: number, total: number) => void = (frame, total) =>
    process.stdout.write(`\rRendering frame ${frame} / ${total}`),
): Promise<void> {
  const proc = Bun.spawn(
    [
      "ffmpeg",
      "-y",
      "-i",
      inputPath,
      "-f",
      "image2pipe",
      "-framerate",
      String(fps),
      "-i",
      "pipe:0",
      "-filter_complex",
      `[1:v]scale=${width}:${height}[sub];[0:v][sub]overlay=0:0[out]`,
      "-map",
      "[out]",
      "-map",
      "0:a?",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "18",
      "-c:a",
      "copy",
      outputPath,
    ],
    {
      stdin: "pipe",
      stdout: "inherit",
      stderr: "inherit",
    },
  );

  let frame = 0;
  for await (const buf of frameGen) {
    frame++;
    onProgress(frame, totalFrames);
    proc.stdin.write(buf);
  }
  process.stdout.write("\n");

  proc.stdin.end();
  const exit = await proc.exited;
  if (exit !== 0) throw new Error(`ffmpeg exited with code ${exit}`);
}
