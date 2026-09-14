import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "../db/client";
import { projects } from "../db/schema";
import { requireAuth, type AuthVariables } from "../auth/middleware";
import type { Env } from "../types";

export async function loadOwnedProject(db: Db, userId: string, projectId: string) {
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
