import { describe, expect, test } from "bun:test";
import { presignUploadUrl, presignDownloadUrl } from "./b2";

const testEnv = {
  DATABASE_URL: "unused",
  GOOGLE_CLIENT_ID: "unused",
  GOOGLE_CLIENT_SECRET: "unused",
  BETTER_AUTH_SECRET: "unused",
  STUDIO_ORIGIN: "unused",
  B2_ENDPOINT: "https://s3.us-west-004.backblazeb2.com",
  B2_REGION: "us-west-004",
  B2_BUCKET: "test-bucket",
  B2_KEY_ID: "test-key-id",
  B2_APPLICATION_KEY: "test-application-key",
};

describe("b2 presigned URLs", () => {
  test("presignUploadUrl produces a signed PUT URL for the given key", async () => {
    const url = await presignUploadUrl(testEnv, "project-1/video.mp4");
    expect(url).toContain("/test-bucket/project-1/video.mp4");
    expect(url).toContain("X-Amz-Signature=");
    expect(url).toContain("X-Amz-Credential=");
  });

  test("presignDownloadUrl produces a signed GET URL for the given key", async () => {
    const url = await presignDownloadUrl(testEnv, "project-1/video.mp4");
    expect(url).toContain("/test-bucket/project-1/video.mp4");
    expect(url).toContain("X-Amz-Signature=");
  });
});
