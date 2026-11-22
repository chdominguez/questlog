import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { createApi, defaultDeps } from "./api";
import { createAuth, sessionFrom } from "./auth";
import { openDb } from "./db";
import { readEnv, type Env } from "./env";
import { startJobs } from "./jobs";
import { createMedia, cspHeader } from "./media";
import { startReminders } from "./reminders";

const config = readEnv();
const db = openDb(config.DB_PATH);
const env: Env = { ...config, DB: db };
const deps = defaultDeps();
deps.session = sessionFrom(createAuth(env, db.sqlite, deps));

const index = () => readFileSync("dist/index.html", "utf8");

const NO_CACHE = ["/sw.js", "/manifest.webmanifest", "/index.html"];

// /api runs the API; everything else is the built app. Unknown paths without a file extension fall back to index.html (client-side routes).
const app = new Hono<{ Bindings: Env }>()
  .route("/api", createApi(deps))
  .route("/", createMedia())
  // No extension, so serveStatic would not send it as JSON, which iOS requires.
  .get("/.well-known/apple-app-site-association", (c) => {
    try { return c.body(readFileSync("dist/.well-known/apple-app-site-association"), 200, { "Content-Type": "application/json" }); }
    catch { return c.text("Not found", 404); }
  })
  .use(async (c, next) => {
    await next();
    if (c.res.status !== 200) return;
    const p = new URL(c.req.url).pathname;
    if (p.startsWith("/assets/")) c.res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    else if (NO_CACHE.includes(p) || p === "/") c.res.headers.set("Cache-Control", "no-cache");
  })
  .use(cspHeader)
  .use(serveStatic({ root: "dist" }))
  .get("*", (c) => /\.\w+$/.test(c.req.path) ? c.text("Not found", 404) : c.html(index()));

serve({ fetch: (req) => app.fetch(req, env), port: env.PORT, hostname: env.HOST });

startJobs(env, deps);
startReminders(env, deps);
