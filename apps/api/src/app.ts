import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "./auth/auth";
import { projectsRoutes } from "./routes/projects";
import { snapshotsRoutes } from "./routes/snapshots";
import type { Env } from "./types";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.onError((err, c) => c.json({ error: "internal server error" }, 500));

  app.use("*", (c, next) =>
    cors({
      origin: c.env.STUDIO_ORIGIN,
      allowHeaders: ["Authorization", "Content-Type"],
    })(c, next),
  );

  app.get("/health", (c) => c.json({ ok: true }));

  app.on(["GET", "POST"], "/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

  app.route("/projects", projectsRoutes);
  app.route("/projects/:projectId/snapshots", snapshotsRoutes);

  return app;
}
