import { Hono, type Context } from "hono";
import type { App, Deps } from "./api";
import { err } from "./errors";

// Stub until WP10 (mobile).
const todo = (c: Context) => err(c, 501, "not_configured");

/** POST /push/device, DELETE /push/device. */
export function devicesRoutes(_deps: Deps): Hono<App> {
  return new Hono<App>().post("/push/device", todo).delete("/push/device", todo);
}
