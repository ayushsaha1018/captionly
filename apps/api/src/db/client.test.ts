import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "./client";
import { projects, user } from "./schema";

const TEST_DATABASE_URL = process.env.DATABASE_URL ?? "";

// Needs a real Neon database (e.g. a dev branch via `neon checkout` + `neon env pull`) —
// skips whenever DATABASE_URL isn't set, both in CI and locally.
describe.skipIf(!process.env.DATABASE_URL)("createDb", () => {
  test("can insert and read back a project row", async () => {
    const db = createDb({
      DATABASE_URL: TEST_DATABASE_URL,
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
    });

    const userId = `test-user-${crypto.randomUUID()}`;
    await db.insert(user).values({ id: userId, email: `${userId}@example.com`, name: userId, emailVerified: true });

    const [inserted] = await db
      .insert(projects)
      .values({ userId, name: "Test Project" })
      .returning();

    expect(inserted.name).toBe("Test Project");
    expect(inserted.videoKey).toBeNull();

    const [fetched] = await db.select().from(projects).where(eq(projects.id, inserted.id));
    expect(fetched?.id).toBe(inserted.id);

    await db.delete(projects).where(eq(projects.id, inserted.id));
    await db.delete(user).where(eq(user.id, userId));
  });
});
