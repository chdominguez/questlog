import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { createApi, type Env } from "./api";
import { openDb } from "./db";
import { runReminders, webPushSend } from "./reminders";

const env: Env = {
  DB: openDb(process.env.DB_PATH ?? "data/questlog.db"),
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
  USER_HEADER: process.env.USER_HEADER || undefined,
  NAME_HEADER: process.env.NAME_HEADER || undefined,
  VAPID_PUBLIC: process.env.VAPID_PUBLIC || undefined,
};
const index = () => readFileSync("dist/index.html", "utf8");

const NO_CACHE = ["/sw.js", "/manifest.webmanifest", "/index.html"];

// /api runs the API; everything else is the built app. Unknown paths without a file extension fall back to index.html (client-side routes).
const app = new Hono<{ Bindings: Env }>()
  .route("/api", createApi())
  .use(async (c, next) => {
    await next();
    if (c.res.status !== 200) return;
    const p = new URL(c.req.url).pathname;
    if (p.startsWith("/assets/")) c.res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    else if (NO_CACHE.includes(p) || p === "/") c.res.headers.set("Cache-Control", "no-cache");
  })
  .use(serveStatic({ root: "dist" }))
  .get("*", (c) => /\.\w+$/.test(c.req.path) ? c.text("Not found", 404) : c.html(index()));

serve({ fetch: (req) => app.fetch(req, env), port: Number(process.env.PORT ?? 8787), hostname: process.env.HOST ?? "127.0.0.1" });

const { VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT } = process.env;
if (VAPID_PUBLIC && VAPID_PRIVATE && VAPID_SUBJECT) {
  const send = webPushSend(VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT);
  setInterval(() => runReminders(env.DB, send).catch((e) => console.error("reminders failed:", e)), 60_000);
}
