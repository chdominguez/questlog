import { Hono, type Context } from "hono";
import type { App, Deps } from "./api";
import { err } from "./errors";

// Stub until WP6 (meter).
const todo = (c: Context) => err(c, 501, "not_configured");

/** GET /narration/audio/:hash, GET /narration/:course/:level, POST /narration. */
export function narrationRoutes(_deps: Deps): Hono<App> {
  return new Hono<App>()
    .get("/narration/audio/:hash", todo) // before /:course/:level, which also matches it
    .get("/narration/:course/:level", todo)
    .post("/narration", todo);
}
