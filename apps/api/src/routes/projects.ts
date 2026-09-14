import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "../db/client";
import { projects } from "../db/schema";
import { requireAuth, type AuthVariables } from "../auth/middleware";
import type { Env } from "../types";
import { presignUploadUrl, presignDownloadUrl } from "../storage/b2";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadOwnedProject(db: Db, userId: string, projectId: string) {
  // projects.id is a Postgres uuid column — a malformed id would otherwise make the
  // query below throw (500) instead of behaving like any other not-found/not-owned case.
  if (!UUID_RE.test(projectId)) {
    return null;
  }
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));
  if (!project || project.userId !== userId) {
    return null;
  }
  return project;
}

export const projectsRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

projectsRoutes.use("*", requireAuth);

projectsRoutes.get("/", async (c) => {
  const db = createDb(c.env);
  const userId = c.get("userId");
  const rows = await db.select().from(projects).where(eq(projects.userId, userId));
  return c.json(rows);
});

projectsRoutes.post("/", async (c) => {
  const db = createDb(c.env);
  const userId = c.get("userId");
  const body = await c.req.json<{ name: string }>();
  const [created] = await db.insert(projects).values({ userId, name: body.name }).returning();
  return c.json(created, 201);
});

projectsRoutes.get("/:id", async (c) => {
  const db = createDb(c.env);
  const project = await loadOwnedProject(db, c.get("userId"), c.req.param("id"));
  if (!project) return c.json({ error: "not found" }, 404);
  return c.json(project);
});

projectsRoutes.patch("/:id", async (c) => {
  const db = createDb(c.env);
  const userId = c.get("userId");
  const projectId = c.req.param("id");
  const existing = await loadOwnedProject(db, userId, projectId);
  if (!existing) return c.json({ error: "not found" }, 404);

  const body = await c.req.json<{
    name?: string;
    videoKey?: string;
    videoMeta?: typeof existing.videoMeta;
  }>();
  // Whitelist fields explicitly — spreading the raw body would let a caller set
  // userId/id and reassign or clobber the row (mass assignment).
  const patch: Partial<typeof projects.$inferInsert> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.videoKey !== undefined) patch.videoKey = body.videoKey;
  if (body.videoMeta !== undefined) patch.videoMeta = body.videoMeta;

  const [updated] = await db
    .update(projects)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning();
  return c.json(updated);
});

projectsRoutes.delete("/:id", async (c) => {
  const db = createDb(c.env);
  const userId = c.get("userId");
  const projectId = c.req.param("id");
  const existing = await loadOwnedProject(db, userId, projectId);
  if (!existing) return c.json({ error: "not found" }, 404);

  await db.delete(projects).where(eq(projects.id, projectId));
  return c.body(null, 204);
});

projectsRoutes.post("/:id/video-upload-url", async (c) => {
  const db = createDb(c.env);
  const project = await loadOwnedProject(db, c.get("userId"), c.req.param("id"));
  if (!project) return c.json({ error: "not found" }, 404);

  const key = `${project.id}/${crypto.randomUUID()}`;
  const uploadUrl = await presignUploadUrl(c.env, key);
  return c.json({ uploadUrl, key });
});

projectsRoutes.get("/:id/video-url", async (c) => {
  const db = createDb(c.env);
  const project = await loadOwnedProject(db, c.get("userId"), c.req.param("id"));
  if (!project) return c.json({ error: "not found" }, 404);
  if (!project.videoKey) return c.json({ error: "no video uploaded" }, 404);

  const downloadUrl = await presignDownloadUrl(c.env, project.videoKey);
  return c.json({ downloadUrl });
});
