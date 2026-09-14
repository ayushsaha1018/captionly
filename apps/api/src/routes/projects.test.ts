import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { createDb } from "../db/client";
import { projects, user, session } from "../db/schema";
import { eq } from "drizzle-orm";

const testEnv = {
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://captionly:captionly@localhost:5433/captionly",
  GOOGLE_CLIENT_ID: "test",
  GOOGLE_CLIENT_SECRET: "test",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret",
  STUDIO_ORIGIN: "http://localhost:5173",
};

// requireAuth checks a real better-auth session, which route-level tests can't cheaply
// fabricate. Insert a session row directly against the test DB and use its token, the same
// way a real client would present one, so every route test below exercises the real
// requireAuth path end to end rather than bypassing it.
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

describe("projects routes", () => {
  test("requires auth", async () => {
    const app = createApp();
    const res = await app.request("/projects", {}, testEnv);
    expect(res.status).toBe(401);
  });

  test("create then list returns the created project for its owner only", async () => {
    const app = createApp();
    const ownerId = `owner-${crypto.randomUUID()}`;
    const otherId = `other-${crypto.randomUUID()}`;
    const ownerToken = await createTestSession(ownerId);
    const otherToken = await createTestSession(otherId);

    const createRes = await app.request(
      "/projects",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${ownerToken}`, "content-type": "application/json" },
        body: JSON.stringify({ name: "My Video" }),
      },
      testEnv,
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.name).toBe("My Video");

    const ownerList = await app.request(
      "/projects",
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      testEnv,
    );
    expect((await ownerList.json()).some((p: { id: string }) => p.id === created.id)).toBe(true);

    const otherGet = await app.request(
      `/projects/${created.id}`,
      { headers: { Authorization: `Bearer ${otherToken}` } },
      testEnv,
    );
    expect(otherGet.status).toBe(404);

    const db = createDb(testEnv);
    await db.delete(projects).where(eq(projects.id, created.id));
    await deleteTestUser(ownerId);
    await deleteTestUser(otherId);
  });
});
