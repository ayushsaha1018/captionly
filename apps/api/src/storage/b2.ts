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

export async function presignUploadUrl(env: Env, key: string): Promise<string> {
  const client = b2Client(env);
  const url = new URL(`${env.B2_ENDPOINT}/${env.B2_BUCKET}/${key}`);
  const signed = await client.sign(new Request(url, { method: "PUT" }), {
    aws: { signQuery: true },
  });
  return signed.url;
}

export async function presignDownloadUrl(env: Env, key: string): Promise<string> {
  const client = b2Client(env);
  const url = new URL(`${env.B2_ENDPOINT}/${env.B2_BUCKET}/${key}`);
  const signed = await client.sign(new Request(url, { method: "GET" }), {
    aws: { signQuery: true },
  });
  return signed.url;
}
