import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { createDb } from "../db/client";
import type { Env } from "../types";

export function createAuth(env: Env) {
  return betterAuth({
    basePath: "/auth",
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
