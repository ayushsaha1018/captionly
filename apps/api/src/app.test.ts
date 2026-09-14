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
