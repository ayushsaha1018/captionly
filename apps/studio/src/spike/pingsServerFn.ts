// Spike-only server functions, proving TanStack Start server functions + D1
// bindings work end-to-end on Cloudflare Workers. Delete alongside the rest
// of src/spike/ once the spike is evaluated.
import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";

export interface Ping {
  id: number;
  message: string;
  created_at: number;
}

export const listPings = createServerFn({ method: "GET" }).handler(async () => {
  const { results } = await env.DB.prepare(
    "SELECT id, message, created_at FROM pings ORDER BY id DESC LIMIT 20",
  ).all<Ping>();
  return results;
});

export const addPing = createServerFn({ method: "POST" })
  .validator((message: string) => message)
  .handler(async ({ data: message }) => {
    await env.DB.prepare("INSERT INTO pings (message, created_at) VALUES (?, ?)")
      .bind(message, Date.now())
      .run();
    return { success: true };
  });
