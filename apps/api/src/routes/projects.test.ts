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
  BETTER_AUTH_URL: "http://localhost:8787",
  STUDIO_ORIGIN: "http://localhost:5173",
  B2_ENDPOINT: "https://s3.us-west-004.backblazeb2.com",
  B2_REGION: "us-west-004",
  B2_BUCKET: "test-bucket",
  B2_KEY_ID: "test-key-id",
  B2_APPLICATION_KEY: "test-application-key",
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

describe.skipIf(!!process.env.CI && !process.env.DATABASE_URL)("projects routes", () => {
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
    const created = (await createRes.json()) as { id: string; name: string };
    expect(created.name).toBe("My Video");

    const ownerList = await app.request(
      "/projects",
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      testEnv,
    );
    const ownerListBody = (await ownerList.json()) as { id: string }[];
    expect(ownerListBody.some((p) => p.id === created.id)).toBe(true);

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

  test("PATCH ignores userId in the body (mass-assignment guard)", async () => {
    const app = createApp();
    const ownerId = `owner-${crypto.randomUUID()}`;
    const ownerToken = await createTestSession(ownerId);

    const createRes = await app.request(
      "/projects",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${ownerToken}`, "content-type": "application/json" },
        body: JSON.stringify({ name: "original" }),
      },
      testEnv,
    );
    const created = (await createRes.json()) as { id: string };

    const patchRes = await app.request(
      `/projects/${created.id}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${ownerToken}`, "content-type": "application/json" },
        body: JSON.stringify({ name: "updated", userId: "some-other-user-id" }),
      },
      testEnv,
    );
    const patched = (await patchRes.json()) as { userId: string; name: string };
    expect(patched.userId).toBe(ownerId);
    expect(patched.name).toBe("updated");

    const db = createDb(testEnv);
    await db.delete(projects).where(eq(projects.id, created.id));
    await deleteTestUser(ownerId);
  });

  test("POST with a missing name returns 400, not 500", async () => {
    const app = createApp();
    const ownerId = `owner-${crypto.randomUUID()}`;
    const ownerToken = await createTestSession(ownerId);

    const res = await app.request(
      "/projects",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${ownerToken}`, "content-type": "application/json" },
        body: JSON.stringify({}),
      },
      testEnv,
    );
    expect(res.status).toBe(400);
    expect((await res.json()) as { error: string }).toEqual({ error: "name is required" });

    await deleteTestUser(ownerId);
  });

  test("GET with a malformed id returns 404, not 500", async () => {
    const app = createApp();
    const ownerId = `owner-${crypto.randomUUID()}`;
    const ownerToken = await createTestSession(ownerId);

    const res = await app.request(
      "/projects/not-a-uuid",
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      testEnv,
    );
    expect(res.status).toBe(404);

    await deleteTestUser(ownerId);
  });
});
