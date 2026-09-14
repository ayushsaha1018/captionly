import { describe, expect, test } from "bun:test";
import { createApp } from "./app";

describe("health check", () => {
  test("GET /health returns ok", async () => {
    const app = createApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("auth", () => {
  test("GET /auth/get-session with no token returns no session", async () => {
    const app = createApp();
    const res = await app.request(
      "/auth/get-session",
      {},
      {
        DATABASE_URL: process.env.DATABASE_URL ?? "postgres://captionly:captionly@localhost:5433/captionly",
        GOOGLE_CLIENT_ID: "test",
        GOOGLE_CLIENT_SECRET: "test",
        BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret",
        STUDIO_ORIGIN: "http://localhost:5173",
      },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});
