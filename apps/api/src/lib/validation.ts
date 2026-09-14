import { zValidator } from "@hono/zod-validator";
import type { ZodType } from "zod";

/**
 * A zValidator("json", schema) wrapper that returns this API's standard
 * { error: string } shape on failure, instead of zod's raw issue list.
 */
export function jsonValidator<T extends ZodType>(schema: T, errorMessage: string) {
  return zValidator("json", schema, (result, c) => {
    if (!result.success) {
      return c.json({ error: errorMessage }, 400);
    }
  });
}
