import { describe, expect, test } from "bun:test";
import { createApp } from "./app";
import { createDb } from "./db/client";
import { projects, user, session } from "./db/schema";
import { eq } from "drizzle-orm";

const testEnvFullFlow = {
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://captionly:captionly@localhost:5433/captionly",
  GOOGLE_CLIENT_ID: "test",
  GOOGLE_CLIENT_SECRET: "test",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret",
  STUDIO_ORIGIN: "http://localhost:5173",
  B2_ENDPOINT: "https://s3.us-west-004.backblazeb2.com",
  B2_REGION: "us-west-004",
  B2_BUCKET: "test-bucket",
  B2_KEY_ID: "test-key-id",
  B2_APPLICATION_KEY: "test-application-key",
};

// requireAuth checks a real better-auth session, which can't be cheaply fabricated. Insert
// a session row directly against the test DB and use its token, the same way a real client
// would present one (see routes/snapshots.test.ts for the same pattern).
async function createTestSession(userId: string) {
  const db = createDb(testEnvFullFlow);
  const token = `flow-token-${crypto.randomUUID()}`;
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
  const db = createDb(testEnvFullFlow);
  // session rows cascade-delete with the user (see schema.auth.ts onDelete: "cascade").
  await db.delete(user).where(eq(user.id, userId));
}

describe("health check", () => {
  test("GET /health returns ok", async () => {
    const app = createApp();
    const res = await app.request("/health", {}, testEnvFullFlow);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("auth", () => {
  test("GET /auth/get-session with no token returns no session", async () => {
    const app = createApp();
    const res = await app.request(
      "/auth/get-session",
      {},
      {
        DATABASE_URL: process.env.DATABASE_URL ?? "postgres://captionly:captionly@localhost:5433/captionly",
        GOOGLE_CLIENT_ID: "test",
        GOOGLE_CLIENT_SECRET: "test",
        BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret",
        STUDIO_ORIGIN: "http://localhost:5173",
      },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});

describe("full flow", () => {
  test("create project, save a snapshot, restore it", async () => {
    const app = createApp();
    const db = createDb(testEnvFullFlow);
    const userId = `flow-user-${crypto.randomUUID()}`;
    const token = await createTestSession(userId);
    const authHeaders = { Authorization: `Bearer ${token}`, "content-type": "application/json" };

    const createRes = await app.request(
      "/projects",
      { method: "POST", headers: authHeaders, body: JSON.stringify({ name: "Flow Test" }) },
      testEnvFullFlow,
    );
    const project = await createRes.json();

    const snapshotRes = await app.request(
      `/projects/${project.id}/snapshots`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ label: "v1", document: { lines: [], style: {} } }),
      },
      testEnvFullFlow,
    );
    expect(snapshotRes.status).toBe(201);
    const snapshotSummary = await snapshotRes.json();

    const restoreRes = await app.request(
      `/projects/${project.id}/snapshots/${snapshotSummary.id}`,
      { headers: authHeaders },
      testEnvFullFlow,
    );
    const restored = await restoreRes.json();
    expect(restored.document).toEqual({ lines: [], style: {} });

    await db.delete(projects).where(eq(projects.id, project.id));
    await deleteTestUser(userId);
  });
});
