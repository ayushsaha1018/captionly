import { describe, test, expect, afterAll } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRenderServer } from "./server";
import { closeBrowser } from "./browserPool";
import { defaultStyle, defaultPosition, defaultAnimation, sampleSubtitles } from "@captionly/engine";

const server = createRenderServer(0);

afterAll(async () => {
  server.stop(true);
  await closeBrowser();
});

async function makeFixtureVideo(dir: string): Promise<string> {
  const path = join(dir, "fixture.mp4");
  const proc = Bun.spawn(
    [
      "ffmpeg",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=1920x1080:d=1:r=10",
      "-pix_fmt",
      "yuv420p",
      path,
    ],
    { stdout: "ignore", stderr: "ignore" },
  );
  const exit = await proc.exited;
  if (exit !== 0) throw new Error("failed to generate fixture video");
  return path;
}

async function extractFrame(videoPath: string, atSeconds: number): Promise<Buffer> {
  const proc = Bun.spawn(
    [
      "ffmpeg",
      "-y",
      "-ss",
      String(atSeconds),
      "-i",
      videoPath,
      "-vframes",
      "1",
      "-pix_fmt",
      "rgb24",
      "-f",
      "rawvideo",
      "-",
    ],
    { stdout: "pipe", stderr: "ignore" },
  );
  const out = await new Response(proc.stdout).arrayBuffer();
  const exit = await proc.exited;
  if (exit !== 0) throw new Error("failed to extract frame");
  return Buffer.from(out);
}

describe("POST /render", () => {
  test("renders an uploaded video with subtitles and returns a valid MP4", async () => {
    const dir = await mkdtemp(join(tmpdir(), "captionly-render-test-"));
    try {
      const videoPath = await makeFixtureVideo(dir);
      const form = new FormData();
      form.append("video", Bun.file(videoPath), "fixture.mp4");
      form.append(
        "subtitles",
        JSON.stringify({
          lines: sampleSubtitles.slice(0, 1),
          style: defaultStyle,
          position: defaultPosition,
          animation: defaultAnimation,
        }),
      );

      const submitRes = await fetch(`http://localhost:${server.port}/render`, {
        method: "POST",
        body: form,
      });
      expect(submitRes.status).toBe(202);
      const { jobId } = (await submitRes.json()) as { jobId: string };

      let status: { status: string; error: string | null } | null = null;
      for (let i = 0; i < 150; i++) {
        const statusRes = await fetch(`http://localhost:${server.port}/render/${jobId}`);
        status = await statusRes.json();
        if (status?.status === "complete" || status?.status === "error") break;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      expect(status?.status).toBe("complete");

      const res = await fetch(`http://localhost:${server.port}/render/${jobId}/output`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("video/mp4");

      const outPath = join(dir, "result.mp4");
      await Bun.write(outPath, await res.arrayBuffer());

      const probe = await Bun.$`ffprobe -v quiet -print_format json -show_streams ${outPath}`.json();
      const videoStream = (probe.streams as Array<Record<string, unknown>>).find(
        (s) => s["codec_type"] === "video",
      );
      expect(videoStream).toBeTruthy();

      // Sample a timestamp within the first sample line's [start, end) range
      // so there's guaranteed-visible subtitle text on screen at that instant.
      const sampleTime = sampleSubtitles[0]!.start + 0.1;
      expect(sampleTime).toBeLessThan(sampleSubtitles[0]!.end);

      const renderedFrame = await extractFrame(outPath, sampleTime);
      const sourceFrame = await extractFrame(videoPath, sampleTime);
      expect(renderedFrame.length).toBe(sourceFrame.length);

      let diffCount = 0;
      for (let i = 0; i < renderedFrame.length; i++) {
        if (renderedFrame[i] !== sourceFrame[i]) diffCount++;
      }
      // Solid blue source vs. rendered output with a burned-in subtitle
      // should differ substantially in the subtitle region; a source with
      // no overlay applied at all would differ by 0.
      expect(diffCount).toBeGreaterThan(1000);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 30000);

  test("rejects a request missing the video field", async () => {
    const form = new FormData();
    form.append("subtitles", "{}");

    const res = await fetch(`http://localhost:${server.port}/render`, {
      method: "POST",
      body: form,
    });

    expect(res.status).toBe(400);
  });
});

describe("GET /render/:id", () => {
  test("404s for an unknown job id", async () => {
    const res = await fetch(`http://localhost:${server.port}/render/does-not-exist`);
    expect(res.status).toBe(404);
  });
});
