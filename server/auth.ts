import { Hono, type Context } from "hono";
import { createPrivateKey, sign } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { bearer, magicLink } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import { NodeSqliteDialect } from "@better-auth/kysely-adapter/node-sqlite-dialect";
import type { Me } from "../shared/api-types";
import { BUILD } from "../shared/pricing";
import type { App, Deps, SessionUser } from "./api";
import type { Env } from "./env";
import { aliasesOf, claimLegacy, purgeUser } from "./account";
import { isAdmin } from "./admin";
import { cancelForUser } from "./billing";
import { credits, metered } from "./credits";
import { magicLinkMail, resetMail, sendMail, verifyMail } from "./email";
import { err } from "./errors";

/** The parts of the Better Auth instance the server uses. */
export interface BetterAuth {
  handler(req: Request): Promise<Response>;
  api: { getSession(a: { headers: Headers }): Promise<{ user: SessionUser } | null> };
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** Apple's client secret: an ES256 JWT valid up to 6 months, made at boot (every deploy restarts the process). */
export function appleSecret(env: Pick<Env, "APPLE_CLIENT_ID" | "APPLE_TEAM_ID" | "APPLE_KEY_ID" | "APPLE_PRIVATE_KEY">, now = new Date()): string {
  const iat = Math.floor(now.getTime() / 1000);
  const head = b64url(JSON.stringify({ alg: "ES256", kid: env.APPLE_KEY_ID }));
  const body = b64url(JSON.stringify({ iss: env.APPLE_TEAM_ID, iat, exp: iat + 180 * 86400, aud: "https://appleid.apple.com", sub: env.APPLE_CLIENT_ID }));
  const key = createPrivateKey(env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n"));
  return `${head}.${body}.${b64url(sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" }))}`;
}

/** Better Auth options (docs/design/questie-backend.md 2.1). Also used to generate migrations/0004_auth.sql. */
export function authOptions(env: Env, sqlite: DatabaseSync, deps: Deps): BetterAuthOptions {
  const mail = !!env.RESEND_API_KEY;
  const send = (m: Parameters<typeof sendMail>[2]) => sendMail(env, deps.fetch, m);
  const apple = env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY && (env.APPLE_CLIENT_ID || env.APPLE_BUNDLE_ID);
  const google = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET;
  return {
    // Same connection as db.tx, so no Better Auth transactions: its async BEGIN would interleave with our sync BEGIN IMMEDIATE.
    // shortcut: Better Auth's multi-row writes (user + account) are not atomic; give it its own connection if that ever matters.
    database: { dialect: new NodeSqliteDialect({ database: sqlite }), type: "sqlite", transaction: false },
    baseURL: env.APP_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: mail,
      disableSignUp: env.SIGNUP === "closed",
      sendResetPassword: ({ user, url }) => send(resetMail(user.email, url)),
    },
    emailVerification: {
      sendVerificationEmail: ({ user, url }) => send(verifyMail(user.email, url)),
      sendOnSignUp: mail,
      autoSignInAfterVerification: true,
    },
    socialProviders: {
      ...(google && {
        // Native apps sign in with ID tokens whose audience is their own client id.
        google: { clientId: [env.GOOGLE_CLIENT_ID!, ...env.GOOGLE_NATIVE_CLIENT_IDS], clientSecret: env.GOOGLE_CLIENT_SECRET! },
      }),
      ...(apple && {
        apple: {
          clientId: env.APPLE_CLIENT_ID ?? env.APPLE_BUNDLE_ID!,
          clientSecret: appleSecret({ ...env, APPLE_CLIENT_ID: env.APPLE_CLIENT_ID ?? env.APPLE_BUNDLE_ID }),
          appBundleIdentifier: env.APPLE_BUNDLE_ID,
          audience: [env.APPLE_CLIENT_ID, env.APPLE_BUNDLE_ID].filter((a): a is string => !!a),
        },
      }),
    },
    account: { accountLinking: { enabled: true, trustedProviders: ["google", "apple"] } },
    trustedOrigins: [env.APP_URL, ...env.APP_ORIGINS, "https://appleid.apple.com"],
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          await cancelForUser(env.DB, env, deps, user.id);
          purgeUser(env.DB, user.id);
        },
      },
    },
    session: { expiresIn: 60 * 86400, updateAge: 86400 },
    rateLimit: {
      enabled: true, window: 60, max: 100,
      customRules: { "/sign-in/email": { window: 60, max: 5 }, "/sign-up/email": { window: 3600, max: 5 } },
    },
    advanced: { cookiePrefix: "questie", ipAddress: { ipAddressHeaders: [env.IP_HEADER] } },
    plugins: [
      bearer(),
      // Sessions from x-api-key: sessionFrom passes the header on GET /notes* only (MCP note tools).
      apiKey({ enableSessionForAPIKeys: true, rateLimit: { enabled: false } }),
      ...(mail ? [magicLink({ sendMagicLink: ({ email, url }) => send(magicLinkMail(email, url)), disableSignUp: env.SIGNUP === "closed" })] : []),
    ],
  };
}

export function createAuth(env: Env, sqlite: DatabaseSync, deps: Deps): BetterAuth {
  return betterAuth(authOptions(env, sqlite, deps)) as unknown as BetterAuth;
}

// createApi copies deps, so /auth/* finds its instance through the session function sessionFrom made.
const instances = new WeakMap<Deps["session"], BetterAuth>();

/** Sign-in methods this server has configured, so the sign-in screens hide the rest. */
export interface AuthMethods { google: boolean; apple: boolean; magicLink: boolean }

/** Public: /auth/* (Better Auth, incl. Apple's form POST callback), plus GET /auth/methods. */
export function authRoutes(deps: Deps): Hono<App> {
  return new Hono<App>().get("/auth/methods", (c) => c.json({
    google: !!(c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET),
    apple: !!(c.env.APPLE_TEAM_ID && c.env.APPLE_KEY_ID && c.env.APPLE_PRIVATE_KEY && (c.env.APPLE_CLIENT_ID || c.env.APPLE_BUNDLE_ID)),
    magicLink: !!c.env.RESEND_API_KEY,
  } satisfies AuthMethods)).on(["GET", "POST"], "/auth/*", (c) => {
    const auth = instances.get(deps.session);
    return auth ? auth.handler(c.req.raw) : err(c, 501, "not_configured");
  });
}

const NOTES_READ = /\/notes(\/[^/]+)?$/;

/** Cookie or bearer session; app-origin requests ignore cookies. Claims legacy rows on the user's first request. */
export function sessionFrom(auth: BetterAuth): Deps["session"] {
  const fn: Deps["session"] = async (c: Context<App>) => {
    const headers = new Headers(c.req.raw.headers);
    if (c.get("appOrigin")) headers.delete("cookie");
    if (!(c.req.method === "GET" && NOTES_READ.test(c.req.path))) headers.delete("x-api-key");
    const s = await auth.api.getSession({ headers });
    if (!s) return null;
    const { id, email, name, emailVerified, image } = s.user;
    const user: SessionUser = { id, email, name, emailVerified, image };
    claimLegacy(c.env.DB, user);
    return user;
  };
  instances.set(fn, auth);
  return fn;
}

/** Private: GET /me. */
export function meRoutes(_deps: Deps): Hono<App> {
  return new Hono<App>().get("/me", (c) => {
    const a = c.get("account");
    return c.json({
      user: a.id, email: a.email, name: a.name, ...(a.image && { image: a.image }),
      admin: isAdmin(a, c.env),
      aliases: aliasesOf(c.env.DB, a.id),
      features: { ai: !!c.env.ANTHROPIC_API_KEY, billing: metered(c.env), narration: !!c.env.ELEVENLABS_API_KEY },
      credits: credits(c.env.DB, c.env, a.id),
      limits: { uploadMaxBytes: BUILD.uploadMaxBytes, uploadMaxFiles: BUILD.uploadMaxFiles },
    } satisfies Me);
  });
}
