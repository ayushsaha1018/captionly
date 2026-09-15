# Auth, Projects & Snapshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `apps/api` Cloudflare Workers service providing optional Google-only
auth, per-user projects (video + subtitle document), and capped cloud snapshot history —
without touching `apps/studio`'s existing local-only editing flow or `apps/render`.

**Architecture:** Hono router on Cloudflare Workers. `better-auth` mounted as a Hono route
for Google OAuth, using its `bearer` plugin (studio and api are on unrelated domains, so
sessions travel as `Authorization: Bearer <token>`, not cookies). Drizzle ORM against Neon
Postgres via the `neon-http` driver (no Hyperdrive — Neon's HTTP driver already solves what
Hyperdrive is for). Video files go to Backblaze B2 via presigned URLs (`aws4fetch` for
signing) — bytes never transit the Worker. Local dev runs against **Neon Local**
(docker-compose) so the exact same `neon-http` driver code path is used locally and in
production; only `DATABASE_URL` differs.

**Tech Stack:** Cloudflare Workers + Wrangler, Hono, better-auth (+ `drizzleAdapter`,
`bearer` plugin), Drizzle ORM (`drizzle-orm/neon-http`, `@neondatabase/serverless`),
Backblaze B2 + `aws4fetch`, Bun (workspace tooling, local test runner), Neon Local (Docker).

**Spec:** `docs/superpowers/specs/2026-09-14-auth-projects-snapshots-design.md`

## Global Constraints

- Google is the only auth provider — no email/password, no other social providers.
- Projects are solo-owned — every route's ownership check is `WHERE user_id =
  session.user.id`; a project that exists but isn't the caller's returns 404, not 403.
- Studio and api run on unrelated domains — sessions use `Authorization: Bearer <token>`,
  never cookies.
- `neon-http` driver only — no Hyperdrive, no `neon-serverless`. All DB access in this plan
  is single-row CRUD; if that stops being true, driver choice is revisited (isolated to
  `src/db/client.ts` — see spec §6).
- Video storage is Backblaze B2 (S3-compatible), not Cloudflare R2.
- Rendering/export (`apps/render`, `apps/studio/src/export`) is out of scope — untouched.
- Snapshot retention cap: keep the 20 most recent snapshots per project; older ones are
  deleted on write.
- Tests are colocated `*.test.ts`, run with `bun test`, matching repo convention.

---

## File Structure

```
apps/api/
  package.json
  wrangler.jsonc              -- Cloudflare Workers deploy config
  tsconfig.json
  drizzle.config.ts           -- drizzle-kit config (points at DATABASE_URL)
  docker-compose.yml           -- Neon Local, for `bun run db:local`
  .dev.vars.example            -- documents required secrets for `wrangler dev`
  src/
    types.ts                   -- shared `Env` (Worker bindings) and `Variables` (Hono context) types
    db/
      schema.ts                 -- projects, snapshots tables
      schema.auth.ts             -- better-auth-generated users/sessions/accounts/verifications
      client.ts                  -- createDb(env) -> drizzle instance (neon-http)
      client.test.ts
    auth/
      auth.ts                    -- createAuth(env) -> better-auth instance (Google-only, bearer plugin)
      middleware.ts               -- requireAuth Hono middleware
      middleware.test.ts
    storage/
      b2.ts                       -- presigned PUT/GET URL helpers (aws4fetch)
      b2.test.ts
    routes/
      projects.ts
      projects.test.ts
      snapshots.ts
      snapshots.test.ts
    app.ts                      -- assembles the Hono app (routes + CORS + auth mount)
    index.ts                    -- Workers entrypoint, exports `app`
    app.test.ts                  -- end-to-end flow test through the assembled app
```

Rationale: `db/`, `auth/`, `storage/`, `routes/` split by responsibility (matches the
spec's own section boundaries), not by technical layer within each concern. `app.ts` is
separate from `index.ts` so tests can import the Hono app directly without a Workers
runtime.

---

### Task 1: Scaffold `apps/api` workspace with a health check route

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/wrangler.jsonc`
- Create: `apps/api/src/types.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/index.ts`
- Test: `apps/api/src/app.test.ts`

**Interfaces:**
- Produces: `Env` type (`apps/api/src/types.ts`) — Worker bindings, extended by later
  tasks; `createApp(): Hono<{ Bindings: Env }>` (`apps/api/src/app.ts`) — every later task
  adds routes to this app.

- [ ] **Step 1: Write `apps/api/package.json`**

```json
{
  "name": "@captionly/api",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "build": "wrangler deploy --dry-run --outdir dist",
    "test": "bun test",
    "deploy": "wrangler deploy",
    "db:local": "docker compose up -d",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250101.0",
    "@types/bun": "latest",
    "drizzle-kit": "^0.30.0",
    "wrangler": "^3.100.0"
  },
  "peerDependencies": {
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Write `apps/api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["@cloudflare/workers-types", "bun-types"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `apps/api/wrangler.jsonc`**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "captionly-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-01",
  "compatibility_flags": ["nodejs_compat"]
}
```

- [ ] **Step 4: Write `apps/api/src/types.ts`**

```ts
export type Env = {
  DATABASE_URL: string;
};
```

- [ ] **Step 5: Write `apps/api/src/app.ts`**

```ts
import { Hono } from "hono";
import type { Env } from "./types";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.get("/health", (c) => c.json({ ok: true }));

  return app;
}
```

- [ ] **Step 6: Write `apps/api/src/index.ts`**

```ts
import { createApp } from "./app";

export default createApp();
```

- [ ] **Step 7: Write the failing test `apps/api/src/app.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import { createApp } from "./app";

describe("health check", () => {
  test("GET /health returns ok", async () => {
    const app = createApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 8: Install dependencies and run the test**

Run: `cd apps/api && bun install && bun test`
Expected: PASS (this is the scaffold task, so the test should pass immediately once the
files above exist — if it fails, check the import paths above).

- [ ] **Step 9: Commit**

```bash
git add apps/api
git commit -m "feat(api): scaffold apps/api Workers service with health check"
```

---

### Task 2: Neon Local for local dev + Drizzle client wiring

**Files:**
- Create: `apps/api/docker-compose.yml`
- Create: `apps/api/.dev.vars.example`
- Create: `apps/api/drizzle.config.ts`
- Create: `apps/api/src/db/schema.ts`
- Create: `apps/api/src/db/client.ts`
- Test: `apps/api/src/db/client.test.ts`
- Modify: `apps/api/src/types.ts` (add `DATABASE_URL` — already present from Task 1)
- Modify: `apps/api/package.json` (add `@neondatabase/serverless`, `drizzle-orm`)

**Interfaces:**
- Consumes: `Env` from `apps/api/src/types.ts` (Task 1).
- Produces: `createDb(env: Env)` (`apps/api/src/db/client.ts`) — returns a Drizzle instance
  typed with the schema below; every later DB-touching task imports this. `projects` and
  `snapshots` Drizzle table objects (`apps/api/src/db/schema.ts`) — exact column names used
  by later tasks: `projects.id`, `projects.userId`, `projects.name`, `projects.videoKey`,
  `projects.videoMeta`, `projects.createdAt`, `projects.updatedAt`; `snapshots.id`,
  `snapshots.projectId`, `snapshots.label`, `snapshots.document`, `snapshots.createdAt`.

- [ ] **Step 1: Add dependencies**

```bash
cd apps/api && bun add drizzle-orm @neondatabase/serverless
```

- [ ] **Step 2: Write `apps/api/docker-compose.yml`** (Neon Local — bridges the HTTP/WS
  protocol `neon-http` speaks so the same driver code works against a local Postgres)

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: captionly
      POSTGRES_PASSWORD: captionly
      POSTGRES_DB: captionly
    ports:
      - "5432:5432"

  neon-local:
    image: neondatabase/neon_local:latest
    environment:
      DRIVER: postgres
      PG_CONNECTION_STRING: postgres://captionly:captionly@postgres:5432/captionly
    ports:
      - "5433:5432"
    depends_on:
      - postgres
```

- [ ] **Step 3: Write `apps/api/.dev.vars.example`**

```
DATABASE_URL=postgres://captionly:captionly@localhost:5433/captionly
```

(Copy this to `.dev.vars` locally — gitignored — for `wrangler dev` to pick up. Production
`DATABASE_URL` points at the real Neon connection string instead, set via `wrangler secret
put DATABASE_URL`.)

- [ ] **Step 4: Write `apps/api/src/db/schema.ts`**

```ts
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  videoKey: text("video_key"),
  videoMeta: jsonb("video_meta").$type<{
    width: number;
    height: number;
    durationSec: number;
    fps: number;
    mimeType: string;
  } | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const snapshots = pgTable("snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  document: jsonb("document").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

`userId` is `text` (not a foreign key to a Drizzle-defined `users` table) because the
`users` table itself is generated by better-auth's CLI in Task 4, not hand-written here —
avoids a forward reference between tasks.

- [ ] **Step 5: Write `apps/api/src/db/client.ts`**

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import type { Env } from "../types";

export function createDb(env: Env) {
  return drizzle(neon(env.DATABASE_URL), { schema });
}

export type Db = ReturnType<typeof createDb>;
```

- [ ] **Step 6: Write `apps/api/drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 7: Start Neon Local and push the schema**

```bash
cd apps/api
bun run db:local
DATABASE_URL=postgres://captionly:captionly@localhost:5433/captionly bunx drizzle-kit push
```

Expected: drizzle-kit reports `projects` and `snapshots` tables created, no errors.

- [ ] **Step 8: Write the failing test `apps/api/src/db/client.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import { createDb } from "./client";
import { projects } from "./schema";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://captionly:captionly@localhost:5433/captionly";

describe("createDb", () => {
  test("can insert and read back a project row", async () => {
    const db = createDb({ DATABASE_URL: TEST_DATABASE_URL });

    const [inserted] = await db
      .insert(projects)
      .values({ userId: "test-user", name: "Test Project" })
      .returning();

    expect(inserted.name).toBe("Test Project");
    expect(inserted.videoKey).toBeNull();

    const [fetched] = await db
      .select()
      .from(projects)
      .where((p) => p.id.eq(inserted.id));
    expect(fetched?.id).toBe(inserted.id);

    await db.delete(projects).where((p) => p.id.eq(inserted.id));
  });
});
```

- [ ] **Step 9: Run test to verify it fails, then passes**

Run: `cd apps/api && DATABASE_URL=postgres://captionly:captionly@localhost:5433/captionly bun test src/db/client.test.ts`
Expected: fails first if Neon Local isn't running yet (connection error) — confirm `bun run
db:local` is up, then re-run: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/api
git commit -m "feat(api): add Neon Local + Drizzle schema for projects/snapshots"
```

---

### Task 3: better-auth (Google-only, bearer plugin)

**Files:**
- Create: `apps/api/src/auth/auth.ts`
- Create: `apps/api/src/db/schema.auth.ts` (generated by better-auth CLI, then committed)
- Modify: `apps/api/src/db/schema.ts` (re-export auth schema so `createDb`'s single
  `schema` object includes it)
- Modify: `apps/api/src/types.ts` (add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `BETTER_AUTH_SECRET`, `STUDIO_ORIGIN`)
- Modify: `apps/api/src/app.ts` (mount `/auth/*`)
- Modify: `apps/api/.dev.vars.example`
- Test: `apps/api/src/app.test.ts` (extend)

**Interfaces:**
- Consumes: `createDb(env)` from Task 2.
- Produces: `createAuth(env: Env)` (`apps/api/src/auth/auth.ts`) — returns a better-auth
  instance whose `.handler` is a `(req: Request) => Promise<Response>` fetch handler, and
  whose `.api.getSession({ headers })` resolves `{ session, user } | null`. Task 4's
  middleware consumes both.

- [ ] **Step 1: Add dependencies**

```bash
cd apps/api && bun add better-auth
```

- [ ] **Step 2: Update `apps/api/src/types.ts`**

```ts
export type Env = {
  DATABASE_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BETTER_AUTH_SECRET: string;
  STUDIO_ORIGIN: string;
};
```

- [ ] **Step 3: Write `apps/api/src/auth/auth.ts`**

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { createDb } from "../db/client";
import type { Env } from "../types";

export function createAuth(env: Env) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.STUDIO_ORIGIN],
    database: drizzleAdapter(createDb(env), { provider: "pg" }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    plugins: [bearer()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
```

- [ ] **Step 4: Generate the better-auth Drizzle schema**

```bash
cd apps/api
DATABASE_URL=postgres://captionly:captionly@localhost:5433/captionly \
  bunx @better-auth/cli generate --config src/auth/auth.ts --output src/db/schema.auth.ts
```

Expected: `apps/api/src/db/schema.auth.ts` is created, exporting Drizzle table definitions
for `user`, `session`, `account`, `verification` (exact export names come from the CLI —
inspect the generated file and use those names verbatim in Step 5; do not rename them).

- [ ] **Step 5: Re-export the combined schema — modify `apps/api/src/db/schema.ts`**

Add to the top of the file (keep the existing `projects`/`snapshots` exports below it
unchanged):

```ts
export * from "./schema.auth";
```

- [ ] **Step 6: Push the new tables**

```bash
cd apps/api
DATABASE_URL=postgres://captionly:captionly@localhost:5433/captionly bunx drizzle-kit push
```

Expected: `user`, `session`, `account`, `verification` tables created alongside
`projects`/`snapshots`.

- [ ] **Step 7: Mount the auth handler — modify `apps/api/src/app.ts`**

```ts
import { Hono } from "hono";
import { createAuth } from "./auth/auth";
import type { Env } from "./types";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.get("/health", (c) => c.json({ ok: true }));

  app.on(["GET", "POST"], "/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

  return app;
}
```

- [ ] **Step 8: Update `apps/api/.dev.vars.example`**

```
DATABASE_URL=postgres://captionly:captionly@localhost:5433/captionly
GOOGLE_CLIENT_ID=replace-with-real-value
GOOGLE_CLIENT_SECRET=replace-with-real-value
BETTER_AUTH_SECRET=replace-with-a-random-32-byte-hex-string
STUDIO_ORIGIN=http://localhost:5173
```

- [ ] **Step 9: Write the failing test — extend `apps/api/src/app.test.ts`**

```ts
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
```

- [ ] **Step 10: Run the test**

Run: `cd apps/api && bun test src/app.test.ts`
Expected: PASS (an unauthenticated session lookup returns `null`, not an error).

- [ ] **Step 11: Commit**

```bash
git add apps/api
git commit -m "feat(api): add better-auth with Google-only sign-in and bearer sessions"
```

---

### Task 4: `requireAuth` middleware

**Files:**
- Create: `apps/api/src/auth/middleware.ts`
- Test: `apps/api/src/auth/middleware.test.ts`

**Interfaces:**
- Consumes: `createAuth(env)` from Task 3.
- Produces: `requireAuth` — a Hono middleware (`MiddlewareHandler<{ Bindings: Env;
  Variables: { userId: string } }>`) that returns `401` when no valid session is present,
  and otherwise sets `c.set("userId", session.user.id)` before calling `next()`. Tasks 5
  and 6 read `c.get("userId")`.

- [ ] **Step 1: Write `apps/api/src/auth/middleware.ts`**

```ts
import type { MiddlewareHandler } from "hono";
import { createAuth } from "./auth";
import type { Env } from "../types";

export type AuthVariables = {
  userId: string;
};

export const requireAuth: MiddlewareHandler<{
  Bindings: Env;
  Variables: AuthVariables;
}> = async (c, next) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "unauthorized" }, 401);
  }
  c.set("userId", session.user.id);
  await next();
};
```

- [ ] **Step 2: Write the failing test `apps/api/src/auth/middleware.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { requireAuth, type AuthVariables } from "./middleware";
import type { Env } from "../types";

const testEnv: Env = {
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://captionly:captionly@localhost:5433/captionly",
  GOOGLE_CLIENT_ID: "test",
  GOOGLE_CLIENT_SECRET: "test",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret",
  STUDIO_ORIGIN: "http://localhost:5173",
};

function buildTestApp() {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  app.get("/protected", requireAuth, (c) => c.json({ userId: c.get("userId") }));
  return app;
}

describe("requireAuth", () => {
  test("rejects requests with no Authorization header", async () => {
    const app = buildTestApp();
    const res = await app.request("/protected", {}, testEnv);
    expect(res.status).toBe(401);
  });

  test("rejects requests with an invalid bearer token", async () => {
    const app = buildTestApp();
    const res = await app.request(
      "/protected",
      { headers: { Authorization: "Bearer not-a-real-token" } },
      testEnv,
    );
    expect(res.status).toBe(401);
  });
});
```

(A third test — "accepts a valid session token" — needs a real signed-in session, which
requires driving better-auth's actual OAuth flow or inserting a session row directly. Add
it in Task 8's end-to-end test instead, once Task 6 gives us a project to authenticate
against; keep this task's tests to the two rejection paths, which don't need a live
session.)

- [ ] **Step 3: Run tests to verify they fail, then pass**

Run: `cd apps/api && bun run db:local && bun test src/auth/middleware.test.ts`
Expected: PASS once `middleware.ts` exists as written — both are rejection paths with no
dependency on a real session.

- [ ] **Step 4: Commit**

```bash
git add apps/api
git commit -m "feat(api): add requireAuth middleware"
```

---

### Task 5: Projects routes

**Files:**
- Create: `apps/api/src/routes/projects.ts`
- Test: `apps/api/src/routes/projects.test.ts`
- Modify: `apps/api/src/app.ts` (mount projects routes)

**Interfaces:**
- Consumes: `createDb(env)` (Task 2), `requireAuth` + `c.get("userId")` (Task 4),
  `projects` table (Task 2).
- Produces: `projectsRoutes` — a `Hono<{ Bindings: Env; Variables: AuthVariables }>`
  sub-app mounted at `/projects`. Task 7 (storage) and Task 6 (snapshots) route handlers
  reuse the same "load project, 404 if not owned by caller" pattern shown here — the
  helper `loadOwnedProject(db, userId, id)` this task defines is imported by both.

- [ ] **Step 1: Write `apps/api/src/routes/projects.ts`**

```ts
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
  const [updated] = await db
    .update(projects)
    .set({ ...body, updatedAt: new Date() })
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
```

- [ ] **Step 2: Mount the routes — modify `apps/api/src/app.ts`**

```ts
import { projectsRoutes } from "./routes/projects";
// ...inside createApp(), after the /auth/* mount:
app.route("/projects", projectsRoutes);
```

- [ ] **Step 3: Write the failing test `apps/api/src/routes/projects.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { createDb } from "../db/client";
import { projects } from "../db/schema";
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
  await db.execute(
    `insert into "user" (id, email, name, "emailVerified") values ($1, $2, $3, true)
     on conflict (id) do nothing`,
    [userId, `${userId}@example.com`, userId],
  );
  await db.execute(
    `insert into session (id, "userId", token, "expiresAt")
     values ($1, $2, $3, now() + interval '1 day')`,
    [crypto.randomUUID(), userId, token],
  );
  return token;
}

describe("projects routes", () => {
  test("requires auth", async () => {
    const app = createApp();
    const res = await app.request("/projects", {}, testEnv);
    expect(res.status).toBe(401);
  });

  test("create then list returns the created project for its owner only", async () => {
    const app = createApp();
    const ownerToken = await createTestSession(`owner-${crypto.randomUUID()}`);
    const otherToken = await createTestSession(`other-${crypto.randomUUID()}`);

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
  });
});
```

- [ ] **Step 4: Run tests**

Run: `cd apps/api && bun run db:local && bun test src/routes/projects.test.ts`
Expected: PASS. If the raw `db.execute` inserts in `createTestSession` fail on column
names, open the generated `apps/api/src/db/schema.auth.ts` from Task 3 and match this
helper's column names to what the CLI actually generated (they're typically camelCase
`userId`/`expiresAt`/`emailVerified` as written above, but confirm against the generated
file rather than assuming).

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): add projects CRUD routes"
```

---

### Task 6: Snapshots routes with retention cap

**Files:**
- Create: `apps/api/src/routes/snapshots.ts`
- Test: `apps/api/src/routes/snapshots.test.ts`
- Modify: `apps/api/src/app.ts` (mount snapshots routes)

**Interfaces:**
- Consumes: `loadOwnedProject` (Task 5), `createDb`, `requireAuth`, `snapshots` table
  (Task 2).
- Produces: `snapshotsRoutes` mounted at `/projects/:projectId/snapshots`. `SNAPSHOT_CAP =
  20` constant, exported for the test to reference rather than hardcoding the number twice.

- [ ] **Step 1: Write `apps/api/src/routes/snapshots.ts`**

```ts
import { Hono } from "hono";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { createDb } from "../db/client";
import { snapshots } from "../db/schema";
import { requireAuth, type AuthVariables } from "../auth/middleware";
import { loadOwnedProject } from "./projects";
import type { Env } from "../types";

export const SNAPSHOT_CAP = 20;

export const snapshotsRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

snapshotsRoutes.use("*", requireAuth);

snapshotsRoutes.get("/", async (c) => {
  const db = createDb(c.env);
  const project = await loadOwnedProject(db, c.get("userId"), c.req.param("projectId"));
  if (!project) return c.json({ error: "not found" }, 404);

  const rows = await db
    .select({ id: snapshots.id, label: snapshots.label, createdAt: snapshots.createdAt })
    .from(snapshots)
    .where(eq(snapshots.projectId, project.id))
    .orderBy(desc(snapshots.createdAt));
  return c.json(rows);
});

snapshotsRoutes.post("/", async (c) => {
  const db = createDb(c.env);
  const project = await loadOwnedProject(db, c.get("userId"), c.req.param("projectId"));
  if (!project) return c.json({ error: "not found" }, 404);

  const body = await c.req.json<{ label: string; document: unknown }>();
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
        notInArray(snapshots.id, keepIds.map((row) => row.id)),
      ),
    );

  return c.json(created, 201);
});

snapshotsRoutes.get("/:snapshotId", async (c) => {
  const db = createDb(c.env);
  const project = await loadOwnedProject(db, c.get("userId"), c.req.param("projectId"));
  if (!project) return c.json({ error: "not found" }, 404);

  const [snapshot] = await db
    .select()
    .from(snapshots)
    .where(
      and(eq(snapshots.id, c.req.param("snapshotId")), eq(snapshots.projectId, project.id)),
    );
  if (!snapshot) return c.json({ error: "not found" }, 404);
  return c.json(snapshot);
});

snapshotsRoutes.delete("/:snapshotId", async (c) => {
  const db = createDb(c.env);
  const project = await loadOwnedProject(db, c.get("userId"), c.req.param("projectId"));
  if (!project) return c.json({ error: "not found" }, 404);

  await db
    .delete(snapshots)
    .where(
      and(eq(snapshots.id, c.req.param("snapshotId")), eq(snapshots.projectId, project.id)),
    );
  return c.body(null, 204);
});
```

- [ ] **Step 2: Mount the routes — modify `apps/api/src/app.ts`**

```ts
import { snapshotsRoutes } from "./routes/snapshots";
// ...inside createApp(), after the /projects mount:
app.route("/projects/:projectId/snapshots", snapshotsRoutes);
```

- [ ] **Step 3: Write the failing test `apps/api/src/routes/snapshots.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { createDb } from "../db/client";
import { projects, snapshots } from "../db/schema";
import { eq } from "drizzle-orm";
import { SNAPSHOT_CAP } from "./snapshots";

const testEnv = {
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://captionly:captionly@localhost:5433/captionly",
  GOOGLE_CLIENT_ID: "test",
  GOOGLE_CLIENT_SECRET: "test",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret",
  STUDIO_ORIGIN: "http://localhost:5173",
};

async function createTestSession(userId: string) {
  const db = createDb(testEnv);
  const token = `test-token-${crypto.randomUUID()}`;
  await db.execute(
    `insert into "user" (id, email, name, "emailVerified") values ($1, $2, $3, true)
     on conflict (id) do nothing`,
    [userId, `${userId}@example.com`, userId],
  );
  await db.execute(
    `insert into session (id, "userId", token, "expiresAt")
     values ($1, $2, $3, now() + interval '1 day')`,
    [crypto.randomUUID(), userId, token],
  );
  return token;
}

describe("snapshots routes", () => {
  test("enforces the retention cap, keeping only the most recent SNAPSHOT_CAP rows", async () => {
    const app = createApp();
    const db = createDb(testEnv);
    const token = await createTestSession(`owner-${crypto.randomUUID()}`);

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

    await db.delete(projects).where(eq(projects.id, project.id));
  });
});
```

- [ ] **Step 4: Run tests**

Run: `cd apps/api && bun run db:local && bun test src/routes/snapshots.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): add snapshots routes with retention cap"
```

---

### Task 7: Video storage — B2 presigned URLs

**Files:**
- Create: `apps/api/src/storage/b2.ts`
- Test: `apps/api/src/storage/b2.test.ts`
- Modify: `apps/api/src/routes/projects.ts` (add the two upload/download URL routes)
- Modify: `apps/api/src/types.ts` (add B2 env vars)
- Modify: `apps/api/.dev.vars.example`

**Interfaces:**
- Consumes: `loadOwnedProject` (Task 5).
- Produces: `presignUploadUrl(env, key)` and `presignDownloadUrl(env, key)`
  (`apps/api/src/storage/b2.ts`), both `(env: Env, key: string) => Promise<string>`.

- [ ] **Step 1: Add dependency**

```bash
cd apps/api && bun add aws4fetch
```

- [ ] **Step 2: Update `apps/api/src/types.ts`**

```ts
export type Env = {
  DATABASE_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BETTER_AUTH_SECRET: string;
  STUDIO_ORIGIN: string;
  B2_ENDPOINT: string; // e.g. https://s3.us-west-004.backblazeb2.com
  B2_REGION: string; // e.g. us-west-004
  B2_BUCKET: string;
  B2_KEY_ID: string;
  B2_APPLICATION_KEY: string;
};
```

- [ ] **Step 3: Write `apps/api/src/storage/b2.ts`**

```ts
import { AwsClient } from "aws4fetch";
import type { Env } from "../types";

function b2Client(env: Env) {
  return new AwsClient({
    accessKeyId: env.B2_KEY_ID,
    secretAccessKey: env.B2_APPLICATION_KEY,
    region: env.B2_REGION,
    service: "s3",
  });
}

export async function presignUploadUrl(env: Env, key: string): Promise<string> {
  const client = b2Client(env);
  const url = new URL(`${env.B2_ENDPOINT}/${env.B2_BUCKET}/${key}`);
  const signed = await client.sign(new Request(url, { method: "PUT" }), {
    aws: { signQuery: true },
  });
  return signed.url;
}

export async function presignDownloadUrl(env: Env, key: string): Promise<string> {
  const client = b2Client(env);
  const url = new URL(`${env.B2_ENDPOINT}/${env.B2_BUCKET}/${key}`);
  const signed = await client.sign(new Request(url, { method: "GET" }), {
    aws: { signQuery: true },
  });
  return signed.url;
}
```

- [ ] **Step 4: Add routes — modify `apps/api/src/routes/projects.ts`**

Add after the existing routes, before `export const projectsRoutes` is used elsewhere (i.e.
just add these two blocks to the file):

```ts
import { presignUploadUrl, presignDownloadUrl } from "../storage/b2";

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
```

- [ ] **Step 5: Update `apps/api/.dev.vars.example`**

Append:

```
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
B2_BUCKET=replace-with-real-value
B2_KEY_ID=replace-with-real-value
B2_APPLICATION_KEY=replace-with-real-value
```

- [ ] **Step 6: Write the failing test `apps/api/src/storage/b2.test.ts`**

This tests the signing logic itself (URL structure, required query params), not a real
network call to B2 — no test should depend on live B2 credentials.

```ts
import { describe, expect, test } from "bun:test";
import { presignUploadUrl, presignDownloadUrl } from "./b2";

const testEnv = {
  DATABASE_URL: "unused",
  GOOGLE_CLIENT_ID: "unused",
  GOOGLE_CLIENT_SECRET: "unused",
  BETTER_AUTH_SECRET: "unused",
  STUDIO_ORIGIN: "unused",
  B2_ENDPOINT: "https://s3.us-west-004.backblazeb2.com",
  B2_REGION: "us-west-004",
  B2_BUCKET: "test-bucket",
  B2_KEY_ID: "test-key-id",
  B2_APPLICATION_KEY: "test-application-key",
};

describe("b2 presigned URLs", () => {
  test("presignUploadUrl produces a signed PUT URL for the given key", async () => {
    const url = await presignUploadUrl(testEnv, "project-1/video.mp4");
    expect(url).toContain("/test-bucket/project-1/video.mp4");
    expect(url).toContain("X-Amz-Signature=");
    expect(url).toContain("X-Amz-Credential=");
  });

  test("presignDownloadUrl produces a signed GET URL for the given key", async () => {
    const url = await presignDownloadUrl(testEnv, "project-1/video.mp4");
    expect(url).toContain("/test-bucket/project-1/video.mp4");
    expect(url).toContain("X-Amz-Signature=");
  });
});
```

- [ ] **Step 7: Run the test**

Run: `cd apps/api && bun test src/storage/b2.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api
git commit -m "feat(api): add B2 presigned upload/download URLs for project videos"
```

---

### Task 8: CORS + end-to-end flow test

**Files:**
- Modify: `apps/api/src/app.ts` (add CORS middleware)
- Test: `apps/api/src/app.test.ts` (extend with the full flow)

**Interfaces:**
- Consumes: everything from Tasks 1–7.
- Produces: nothing new consumed by later tasks — this is the plan's final task.

- [ ] **Step 1: Add CORS — modify `apps/api/src/app.ts`**

```ts
import { cors } from "hono/cors";
// ...inside createApp(), before any routes are registered:
app.use("*", (c, next) =>
  cors({
    origin: c.env.STUDIO_ORIGIN,
    allowHeaders: ["Authorization", "Content-Type"],
  })(c, next),
);
```

- [ ] **Step 2: Write the failing end-to-end test — extend `apps/api/src/app.test.ts`**

```ts
import { createDb } from "./db/client";
import { projects } from "./db/schema";
import { eq } from "drizzle-orm";

test("full flow: create project, save a snapshot, restore it", async () => {
  const app = createApp();
  const db = createDb(testEnvFullFlow);
  const userId = `flow-user-${crypto.randomUUID()}`;
  await db.execute(
    `insert into "user" (id, email, name, "emailVerified") values ($1, $2, $3, true)`,
    [userId, `${userId}@example.com`, userId],
  );
  const token = `flow-token-${crypto.randomUUID()}`;
  await db.execute(
    `insert into session (id, "userId", token, "expiresAt")
     values ($1, $2, $3, now() + interval '1 day')`,
    [crypto.randomUUID(), userId, token],
  );
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
});
```

Add the `testEnvFullFlow` constant at the top of the file (same shape as `testEnv` used in
Task 3's test, plus the B2 vars from Task 7 — all can be dummy values since this test never
calls the storage routes).

- [ ] **Step 3: Run all `apps/api` tests**

Run: `cd apps/api && bun run db:local && bun test`
Expected: PASS across every test file written in this plan.

- [ ] **Step 4: Commit**

```bash
git add apps/api
git commit -m "feat(api): add CORS and end-to-end auth/projects/snapshots flow test"
```

---

## Post-plan setup (not code — do once, outside this plan's tasks)

- Create the real Neon project (`neon link` / `neon checkout`, per the CLI already
  installed) and run `wrangler secret put DATABASE_URL` (and the other secrets in
  `.dev.vars.example`) against it for the deployed Worker.
- Register the studio's real deployed origin in Google's OAuth consent screen redirect
  URIs, and in `STUDIO_ORIGIN`.
- Create the Backblaze B2 bucket + application key.
- `apps/studio` integration (the `useAuth` hook, hiding/showing cloud-save UI, calling
  these endpoints) is deliberately not in this plan — it's frontend work against a stable
  API surface and can be its own follow-up plan once this one is merged and deployed.
