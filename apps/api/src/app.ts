import { Hono } from "hono";
import { createAuth } from "./auth/auth";
import { projectsRoutes } from "./routes/projects";
import { snapshotsRoutes } from "./routes/snapshots";
import type { Env } from "./types";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.get("/health", (c) => c.json({ ok: true }));

  app.on(["GET", "POST"], "/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

  app.route("/projects", projectsRoutes);
  app.route("/projects/:projectId/snapshots", snapshotsRoutes);

  return app;
}
