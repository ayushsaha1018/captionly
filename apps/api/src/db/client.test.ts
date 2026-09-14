import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "./client";
import { projects } from "./schema";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://captionly:captionly@localhost:5433/captionly";

// CI has no Neon Local stack (docker compose) running — this needs `bun run db:local`
// against a real local Postgres, so it only runs when DATABASE_URL is set explicitly
// (i.e. never in CI) or outside CI where `bun run db:local` is expected to be up.
describe.skipIf(!!process.env.CI && !process.env.DATABASE_URL)("createDb", () => {
  test("can insert and read back a project row", async () => {
    const db = createDb({ DATABASE_URL: TEST_DATABASE_URL });

    const [inserted] = await db
      .insert(projects)
      .values({ userId: "test-user", name: "Test Project" })
      .returning();

    expect(inserted.name).toBe("Test Project");
    expect(inserted.videoKey).toBeNull();

    const [fetched] = await db.select().from(projects).where(eq(projects.id, inserted.id));
    expect(fetched?.id).toBe(inserted.id);

    await db.delete(projects).where(eq(projects.id, inserted.id));
  });
});
