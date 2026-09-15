import { AwsClient } from "aws4fetch";
import type { Env } from "../types";

function b2Client(env: Env) {
  return new AwsClient({
    accessKeyId: env.B2_KEY_ID,
    secretAccessKey: env.B2_APPLICATION_KEY,
    region: env.B2_REGION,
    service: "s3",
  });
}

export function publicUrl(env: Env, key: string): string {
  return `${env.B2_ENDPOINT}/${env.B2_BUCKET}/${key}`;
}

export async function presignUploadUrl(env: Env, key: string): Promise<string> {
  const client = b2Client(env);
  const url = new URL(publicUrl(env, key));
  url.searchParams.set("X-Amz-Expires", "3600");
  const signed = await client.sign(new Request(url, { method: "PUT" }), {
    aws: { signQuery: true },
  });
  return signed.url;
}
