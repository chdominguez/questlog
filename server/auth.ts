import { Hono, type Context } from "hono";
import type { DatabaseSync } from "node:sqlite";
import type { Me } from "../shared/api-types";
import { BUILD } from "../shared/pricing";
import type { App, Deps, SessionUser } from "./api";
import type { Env } from "./env";
import { isAdmin } from "./admin";
import { credits, metered } from "./credits";
import { err } from "./errors";

// Stub until WP3 (auth): no Better Auth yet, so nobody has a session.

/** The parts of the Better Auth instance the server uses. */
export interface BetterAuth {
  handler(req: Request): Promise<Response>;
  api: { getSession(a: { headers: Headers }): Promise<{ user: SessionUser } | null> };
}

export function createAuth(_env: Env, _sqlite: DatabaseSync, _deps: Deps): BetterAuth {
  return { handler: async () => new Response(null, { status: 501 }), api: { getSession: async () => null } };
}

/** Public: /auth/* (Better Auth). */
export function authRoutes(_deps: Deps): Hono<App> {
  return new Hono<App>().on(["GET", "POST"], "/auth/*", (c) => err(c, 501, "not_configured"));
}

/** Private: GET /me. */
export function meRoutes(_deps: Deps): Hono<App> {
  return new Hono<App>().get("/me", (c) => {
    const a = c.get("account");
    return c.json({
      user: a.id, email: a.email, name: a.name, ...(a.image && { image: a.image }),
      admin: isAdmin(a, c.env),
      aliases: [],
      features: { ai: !!c.env.ANTHROPIC_API_KEY, billing: metered(c.env), narration: !!c.env.ELEVENLABS_API_KEY },
      credits: credits(c.env.DB, c.env, a.id),
      limits: { uploadMaxBytes: BUILD.uploadMaxBytes, uploadMaxFiles: BUILD.uploadMaxFiles },
    } satisfies Me);
  });
}

export function sessionFrom(auth: BetterAuth): Deps["session"] {
  return async (c: Context<App>) => (await auth.api.getSession({ headers: c.req.raw.headers }))?.user ?? null;
}
