import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import type { Env } from "../types";

export function createDb(env: Env) {
  const { hostname, port } = new URL(env.DATABASE_URL);
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    // Local Neon proxy (see docker-compose.yml) speaks plain HTTP, not HTTPS.
    neonConfig.fetchEndpoint = `http://${hostname}:${port || 5433}/sql`;
  }
  return drizzle(neon(env.DATABASE_URL), { schema });
}

export type Db = ReturnType<typeof createDb>;
