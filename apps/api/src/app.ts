import { Hono } from "hono";
import { createAuth } from "./auth/auth";
import type { Env } from "./types";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.get("/health", (c) => c.json({ ok: true }));

  app.on(["GET", "POST"], "/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

  return app;
}
