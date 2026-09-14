export type Env = {
  DATABASE_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  STUDIO_ORIGIN: string;
  B2_ENDPOINT: string; // e.g. https://s3.us-west-004.backblazeb2.com
  B2_REGION: string; // e.g. us-west-004
  B2_BUCKET: string;
  B2_KEY_ID: string;
  B2_APPLICATION_KEY: string;
};
