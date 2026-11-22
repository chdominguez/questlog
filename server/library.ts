import { Hono, type Context } from "hono";
import type { App, Deps } from "./api";
import { requireAdmin } from "./admin";
import { err } from "./errors";

// Stub until WP7 (library).
const todo = (c: Context) => err(c, 501, "not_configured");

/** Course sharing and publishing, GET /library, POST /flags, admin review. */
export function libraryRoutes(_deps: Deps): Hono<App> {
  return new Hono<App>()
    .post("/courses/:id/share", todo)
    .post("/courses/:id/publish", todo)
    .post("/courses/:id/unpublish", todo)
    .get("/library", todo)
    .post("/flags", todo)
    .get("/admin/review", requireAdmin, todo)
    .post("/admin/courses/:id/approve", requireAdmin, todo)
    .post("/admin/courses/:id/reject", requireAdmin, todo)
    .post("/admin/flags/:id/resolve", requireAdmin, todo);
}
