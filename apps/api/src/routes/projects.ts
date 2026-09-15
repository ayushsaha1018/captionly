import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createDb, type Db } from "../db/client";
import { projects } from "../db/schema";
import { requireAuth, type AuthVariables } from "../auth/middleware";
import type { Env } from "../types";
import { presignUploadUrl, publicUrl } from "../storage/b2";
import { jsonValidator } from "../lib/validation";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createProjectSchema = z.object({ name: z.string().min(1) });

const videoMetaSchema = z
  .object({
    width: z.number(),
    height: z.number(),
    durationSec: z.number(),
    fps: z.number(),
    mimeType: z.string(),
  })
  .nullable();

const patchProjectSchema = z.object({
  name: z.string().min(1).optional(),
  videoUrl: z.string().url().optional(),
  videoMeta: videoMetaSchema.optional(),
});

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

projectsRoutes.post("/", jsonValidator(createProjectSchema, "name is required"), async (c) => {
  const db = createDb(c.env);
  const userId = c.get("userId");
  const { name } = c.req.valid("json");
  const [created] = await db.insert(projects).values({ userId, name }).returning();
  return c.json(created, 201);
});

projectsRoutes.get("/:id", async (c) => {
  const db = createDb(c.env);
  const project = await loadOwnedProject(db, c.get("userId"), c.req.param("id"));
  if (!project) return c.json({ error: "not found" }, 404);
  return c.json(project);
});

projectsRoutes.patch(
  "/:id",
  jsonValidator(patchProjectSchema, "invalid request body"),
  async (c) => {
    const db = createDb(c.env);
    const userId = c.get("userId");
    const projectId = c.req.param("id");
    const existing = await loadOwnedProject(db, userId, projectId);
    if (!existing) return c.json({ error: "not found" }, 404);

    const body = c.req.valid("json");
    // Whitelist fields explicitly — spreading the raw body would let a caller set
    // userId/id and reassign or clobber the row (mass assignment).
    const patch: Partial<typeof projects.$inferInsert> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.videoUrl !== undefined) {
      if (!body.videoUrl.startsWith(publicUrl(c.env, `${projectId}/`))) {
        return c.json({ error: "videoUrl does not belong to this project" }, 400);
      }
      patch.videoUrl = body.videoUrl;
    }
    if (body.videoMeta !== undefined) patch.videoMeta = body.videoMeta;

    const [updated] = await db
      .update(projects)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning();
    return c.json(updated);
  },
);

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
  return c.json({ uploadUrl, videoUrl: publicUrl(c.env, key) });
});
