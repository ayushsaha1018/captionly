import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { requireAuth, type AuthVariables } from "./middleware";
import type { Env } from "../types";

const testEnv: Env = {
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://captionly:captionly@localhost:5433/captionly",
  GOOGLE_CLIENT_ID: "test",
  GOOGLE_CLIENT_SECRET: "test",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret",
  STUDIO_ORIGIN: "http://localhost:5173",
};

function buildTestApp() {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  app.get("/protected", requireAuth, (c) => c.json({ userId: c.get("userId") }));
  return app;
}

describe("requireAuth", () => {
  test("rejects requests with no Authorization header", async () => {
    const app = buildTestApp();
    const res = await app.request("/protected", {}, testEnv);
    expect(res.status).toBe(401);
  });

  test("rejects requests with an invalid bearer token", async () => {
    const app = buildTestApp();
    const res = await app.request(
      "/protected",
      { headers: { Authorization: "Bearer not-a-real-token" } },
      testEnv,
    );
    expect(res.status).toBe(401);
  });
});
