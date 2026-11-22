import { Hono, type Context } from "hono";
import type { App, Deps } from "./api";
import { err } from "./errors";

// Stub until WP5 (builder).
const todo = (c: Context) => err(c, 501, "not_configured");

/** POST /builder/uploads, POST /builder/jobs, GET /jobs, GET /jobs/:id. */
export function builderRoutes(_deps: Deps): Hono<App> {
  return new Hono<App>()
    .post("/builder/uploads", todo)
    .post("/builder/jobs", todo)
    .get("/jobs", todo)
    .get("/jobs/:id", todo);
}
