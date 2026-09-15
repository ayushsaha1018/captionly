import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import type { Env } from "../types";

export function createDb(env: Env) {
  return drizzle(neon(env.DATABASE_URL), { schema });
}

export type Db = ReturnType<typeof createDb>;
