import { Hono } from "hono";
import { createApi, type Env } from "./api";

// Static assets (dist) are served by Cloudflare before the worker; only /api/* runs it (wrangler.jsonc run_worker_first).
export default new Hono<{ Bindings: Env }>().route("/api", createApi());
