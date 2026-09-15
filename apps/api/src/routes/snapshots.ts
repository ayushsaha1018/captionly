import { Hono } from "hono";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { createDb } from "../db/client";
import { snapshots } from "../db/schema";
import { requireAuth, type AuthVariables } from "../auth/middleware";
import { loadOwnedProject } from "./projects";
import type { Env } from "../types";
import { jsonValidator } from "../lib/validation";

export const SNAPSHOT_CAP = 20;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createSnapshotSchema = z.object({
  label: z.string().min(1),
  document: z.unknown().refine((value) => value !== undefined, "document is required"),
});

export const snapshotsRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

snapshotsRoutes.use("*", requireAuth);

snapshotsRoutes.get("/", async (c) => {
  const db = createDb(c.env);
  const projectId = c.req.param("projectId");
  if (!projectId) return c.json({ error: "not found" }, 404);
  const project = await loadOwnedProject(db, c.get("userId"), projectId);
  if (!project) return c.json({ error: "not found" }, 404);

  const rows = await db
    .select({ id: snapshots.id, label: snapshots.label, createdAt: snapshots.createdAt })
    .from(snapshots)
    .where(eq(snapshots.projectId, project.id))
    .orderBy(desc(snapshots.createdAt));
  return c.json(rows);
});

snapshotsRoutes.post(
  "/",
  jsonValidator(createSnapshotSchema, "label and document are required"),
  async (c) => {
    const db = createDb(c.env);
    const projectId = c.req.param("projectId");
    if (!projectId) return c.json({ error: "not found" }, 404);
    const project = await loadOwnedProject(db, c.get("userId"), projectId);
    if (!project) return c.json({ error: "not found" }, 404);

    const body = c.req.valid("json");
    const [created] = await db
      .insert(snapshots)
      .values({ projectId: project.id, label: body.label, document: body.document })
      .returning({ id: snapshots.id, label: snapshots.label, createdAt: snapshots.createdAt });

    const keepIds = await db
      .select({ id: snapshots.id })
      .from(snapshots)
      .where(eq(snapshots.projectId, project.id))
      .orderBy(desc(snapshots.createdAt))
      .limit(SNAPSHOT_CAP);

    await db
      .delete(snapshots)
      .where(
        and(
          eq(snapshots.projectId, project.id),
          notInArray(
            snapshots.id,
            keepIds.map((row) => row.id),
          ),
        ),
      );

    return c.json(created, 201);
  },
);

snapshotsRoutes.get("/:snapshotId", async (c) => {
  const db = createDb(c.env);
  const projectId = c.req.param("projectId");
  if (!projectId) return c.json({ error: "not found" }, 404);
  const project = await loadOwnedProject(db, c.get("userId"), projectId);
  if (!project) return c.json({ error: "not found" }, 404);

  const snapshotId = c.req.param("snapshotId");
  // snapshots.id is a Postgres uuid column — a malformed id would otherwise make the
  // query below throw (500) instead of behaving like any other not-found case.
  if (!UUID_RE.test(snapshotId)) return c.json({ error: "not found" }, 404);

  const [snapshot] = await db
    .select()
    .from(snapshots)
    .where(and(eq(snapshots.id, snapshotId), eq(snapshots.projectId, project.id)));
  if (!snapshot) return c.json({ error: "not found" }, 404);
  return c.json(snapshot);
});

snapshotsRoutes.delete("/:snapshotId", async (c) => {
  const db = createDb(c.env);
  const projectId = c.req.param("projectId");
  if (!projectId) return c.json({ error: "not found" }, 404);
  const project = await loadOwnedProject(db, c.get("userId"), projectId);
  if (!project) return c.json({ error: "not found" }, 404);

  const snapshotId = c.req.param("snapshotId");
  if (!UUID_RE.test(snapshotId)) return c.json({ error: "not found" }, 404);

  await db
    .delete(snapshots)
    .where(and(eq(snapshots.id, snapshotId), eq(snapshots.projectId, project.id)));
  return c.body(null, 204);
});
