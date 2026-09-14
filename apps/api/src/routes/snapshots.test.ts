import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { createDb } from "../db/client";
import { projects, user, session } from "../db/schema";
import { eq } from "drizzle-orm";
import { SNAPSHOT_CAP } from "./snapshots";

const testEnv = {
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://captionly:captionly@localhost:5433/captionly",
  GOOGLE_CLIENT_ID: "test",
  GOOGLE_CLIENT_SECRET: "test",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret",
  STUDIO_ORIGIN: "http://localhost:5173",
};

// requireAuth checks a real better-auth session, which route-level tests can't cheaply
// fabricate. Insert a session row directly against the test DB and use its token, the same
// way a real client would present one, so route tests exercise the real requireAuth path.
async function createTestSession(userId: string) {
  const db = createDb(testEnv);
  const token = `test-token-${crypto.randomUUID()}`;
  await db
    .insert(user)
    .values({ id: userId, email: `${userId}@example.com`, name: userId, emailVerified: true })
    .onConflictDoNothing();
  await db.insert(session).values({
    id: crypto.randomUUID(),
    userId,
    token,
    expiresAt: new Date(Date.now() + 86400000),
  });
  return token;
}

async function deleteTestUser(userId: string) {
  const db = createDb(testEnv);
  // session rows cascade-delete with the user (see schema.auth.ts onDelete: "cascade").
  await db.delete(user).where(eq(user.id, userId));
}

describe("snapshots routes", () => {
  test("enforces the retention cap, keeping only the most recent SNAPSHOT_CAP rows", async () => {
    const app = createApp();
    const db = createDb(testEnv);
    const ownerId = `owner-${crypto.randomUUID()}`;
    const token = await createTestSession(ownerId);

    const projectRes = await app.request(
      "/projects",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ name: "Cap Test" }),
      },
      testEnv,
    );
    const project = await projectRes.json();

    for (let i = 0; i < SNAPSHOT_CAP + 5; i++) {
      const res = await app.request(
        `/projects/${project.id}/snapshots`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ label: `Snapshot ${i}`, document: { i } }),
        },
        testEnv,
      );
      expect(res.status).toBe(201);
    }

    const listRes = await app.request(
      `/projects/${project.id}/snapshots`,
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv,
    );
    const list = await listRes.json();
    expect(list.length).toBe(SNAPSHOT_CAP);
    expect(list[0].label).toBe(`Snapshot ${SNAPSHOT_CAP + 4}`); // newest first

    const getRes = await app.request(
      `/projects/${project.id}/snapshots/${list[0].id}`,
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv,
    );
    expect(getRes.status).toBe(200);
    expect((await getRes.json()).label).toBe(list[0].label);

    const deleteRes = await app.request(
      `/projects/${project.id}/snapshots/${list[0].id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      testEnv,
    );
    expect(deleteRes.status).toBe(204);

    await db.delete(projects).where(eq(projects.id, project.id));
    await deleteTestUser(ownerId);
  }, 60000); // SNAPSHOT_CAP + 5 sequential HTTP round trips through the local neon proxy exceed bun's 5s default.

  test("GET with a malformed snapshotId returns 404, not 500", async () => {
    const app = createApp();
    const db = createDb(testEnv);
    const ownerId = `owner-${crypto.randomUUID()}`;
    const token = await createTestSession(ownerId);

    const projectRes = await app.request(
      "/projects",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ name: "Malformed Id Test" }),
      },
      testEnv,
    );
    const project = await projectRes.json();

    const res = await app.request(
      `/projects/${project.id}/snapshots/not-a-uuid`,
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv,
    );
    expect(res.status).toBe(404);

    await db.delete(projects).where(eq(projects.id, project.id));
    await deleteTestUser(ownerId);
  });
});
