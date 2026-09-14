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
