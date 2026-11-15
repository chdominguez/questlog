import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { createApi, type Env } from "./api";
import { openDb } from "./db";

const env: Env = {
  DB: openDb(process.env.DB_PATH ?? "data/questlog.db"),
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
  USER_HEADER: process.env.USER_HEADER || undefined,
  NAME_HEADER: process.env.NAME_HEADER || undefined,
};
const index = () => readFileSync("dist/index.html", "utf8");

// /api runs the API; everything else is the built app, with unknown paths falling back to index.html (client-side routes).
const app = new Hono<{ Bindings: Env }>()
  .route("/api", createApi())
  .use(serveStatic({ root: "dist" }))
  .get("*", (c) => c.html(index()));

serve({ fetch: (req) => app.fetch(req, env), port: Number(process.env.PORT ?? 8787), hostname: process.env.HOST ?? "127.0.0.1" });
