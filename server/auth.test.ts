import { Hono } from "hono";
import { generateKeyPairSync, createPublicKey, verify } from "node:crypto";
import { beforeEach, expect, test, vi } from "vitest";
import type { Me } from "../shared/api-types";
import { createApi, defaultDeps, type Deps, type Env } from "./api";
import { appleSecret, createAuth, sessionFrom } from "./auth";
import { memoryDb } from "./db";
import { testEnv } from "./env";

const { cancelForUser } = vi.hoisted(() => ({ cancelForUser: vi.fn(async () => {}) }));
vi.mock("./billing", async (real) => ({ ...(await real<typeof import("./billing")>()), cancelForUser }));

let env: Env;
let mails: { to: string[]; subject: string; text: string }[];
const fakeFetch = (async (url: string, init?: RequestInit) => {
  expect(url).toBe("https://api.resend.com/emails");
  mails.push(JSON.parse(init!.body as string));
  return new Response("{}");
}) as unknown as typeof fetch;

/** Real Better Auth on a memory DB, mounted under /api like server/index.ts. */
function setup(over: Partial<Env> = {}, depsOver: Partial<Deps> = {}) {
  const db = memoryDb();
  env = testEnv(db, over);
  mails = [];
  const deps = defaultDeps({ fetch: fakeFetch, ...depsOver });
  deps.session = sessionFrom(createAuth(env, db.sqlite, deps));
  const app = new Hono<{ Bindings: Env }>().route("/api", createApi(deps));
  const req = (path: string, init: RequestInit = {}) => app.request(`http://localhost/api${path}`, init, env);
  return { db, req };
}
const post = (body: unknown, headers: Record<string, string> = {}): RequestInit =>
  ({ method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

// Better Auth's limiter is per IP (IP_HEADER), so each sign-up comes from its own address.
let n = 0;
const ip = () => `10.0.${n >> 8 & 255}.${n++ & 255}`;

type Req = ReturnType<typeof setup>["req"];
async function signUp(req: Req, email = "ada@x.com") {
  const res = await req("/auth/sign-up/email", post({ email, password: "password123", name: "Ada" }, { "x-forwarded-for": ip() }));
  expect(res.status).toBe(200);
  return { cookie: res.headers.get("set-cookie")!.split(";")[0], token: res.headers.get("set-auth-token")!, id: ((await res.json()) as { user: { id: string } }).user.id };
}

beforeEach(() => { vi.restoreAllMocks(); cancelForUser.mockClear(); });

test("session via cookie and via bearer; /me returns the account", async () => {
  const { req } = setup();
  const { cookie, token, id } = await signUp(req);
  expect(cookie).toMatch(/^questie\.session_token=/);
  for (const headers of [{ cookie }, { Authorization: `Bearer ${token}` }] as Record<string, string>[]) {
    const res = await req("/me", { headers });
    expect(res.status).toBe(200);
    const me = (await res.json()) as Me;
    expect(me).toMatchObject({ user: id, email: "ada@x.com", name: "Ada", admin: false, features: { ai: false, billing: false, narration: false }, credits: null });
  }
  expect((await req("/me")).status).toBe(401);
});

test("db.tx while Better Auth writes: no nested transaction", async () => {
  const { db, req } = setup();
  const errors: unknown[] = [];
  let stop = false;
  const spin = (async () => {
    while (!stop) {
      try { db.tx((q) => q.get("SELECT 1")); } catch (e) { errors.push(e); }
      await new Promise((r) => setImmediate(r));
    }
  })();
  for (const email of ["a@x.com", "b@x.com", "c@x.com"]) await signUp(req, email);
  stop = true;
  await spin;
  expect(errors).toEqual([]);
});

test("app-origin requests ignore cookies and use the bearer token", async () => {
  const { req } = setup();
  const { cookie, token } = await signUp(req);
  const origin = { Origin: "capacitor://localhost", "Sec-Fetch-Site": "cross-site" };
  expect((await req("/me", { headers: { ...origin, cookie } })).status).toBe(401);
  expect((await req("/me", { headers: { ...origin, Authorization: `Bearer ${token}` } })).status).toBe(200);
});

test("sign-in is limited to 5 per minute per IP", async () => {
  const { req } = setup();
  await signUp(req);
  const from = ip();
  const tries = [];
  for (let i = 0; i < 6; i++) tries.push((await req("/auth/sign-in/email", post({ email: "ada@x.com", password: "wrong-pass" }, { "x-forwarded-for": from }))).status);
  expect(tries.slice(0, 5)).not.toContain(429);
  expect(tries[5]).toBe(429);
});

test("auth methods reflect the configured providers and mail", async () => {
  expect(await (await setup().req("/auth/methods")).json()).toEqual({ google: false, apple: false, magicLink: false });
  const { req } = setup({ GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "s", RESEND_API_KEY: "re" });
  expect(await (await req("/auth/methods")).json()).toEqual({ google: true, apple: false, magicLink: true });
});

test("SIGNUP=closed blocks email sign-up", async () => {
  const { req } = setup({ SIGNUP: "closed" });
  const res = await req("/auth/sign-up/email", post({ email: "a@x.com", password: "password123", name: "A" }, { "x-forwarded-for": ip() }));
  expect(res.status).toBeGreaterThanOrEqual(400);
});

test("with Resend: sign-up needs verification and sends one mail; admin needs the verified email", async () => {
  const { req, db } = setup({ RESEND_API_KEY: "re_test", EMAIL_FROM: "Q <q@x.com>", ADMIN_EMAILS: ["ada@x.com"] });
  const res = await req("/auth/sign-up/email", post({ email: "ada@x.com", password: "password123", name: "Ada" }, { "x-forwarded-for": ip() }));
  expect(res.status).toBe(200);
  await vi.waitFor(() => expect(mails).toHaveLength(1));
  expect(mails[0]).toMatchObject({ to: ["ada@x.com"], subject: "Verify your email" });
  expect((await req("/auth/sign-in/email", post({ email: "ada@x.com", password: "password123" }, { "x-forwarded-for": ip() }))).status).toBe(403);
  const url = /https?:\/\/\S+/.exec(mails[0].text)![0];
  const verified = await req(url.replace("http://localhost/api", ""));
  expect(verified.status).toBe(302);
  const cookie = verified.headers.get("set-cookie")!.split(";")[0];
  const me = (await (await req("/me", { headers: { cookie } })).json()) as Me;
  expect(me.admin).toBe(true);
  expect(await db.prepare(`SELECT "emailVerified" AS v FROM "user"`).first()).toEqual({ v: 1 });
});

test("without Resend, mail is logged and fetch is not called", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const { req } = setup();
  await signUp(req);
  expect((await req("/auth/request-password-reset", post({ email: "ada@x.com", redirectTo: "/#/reset" }))).status).toBe(200);
  await vi.waitFor(() => expect(log).toHaveBeenCalledWith(expect.stringContaining("Reset your password")));
  expect(mails).toHaveLength(0);
});

const seedLegacy = async (db: ReturnType<typeof memoryDb>, old: string) => {
  await db.prepare("INSERT INTO answers (id, course_id, challenge_id, level_id, prompt, answer, source, created_at, user_id) VALUES (?, 'c', 'c:w', 'l', 'p', 'a', 'typed', '2026', ?)").bind(`a-${old}`, old).run();
  await db.prepare("INSERT INTO notes (id, title, body, tags, created_at, updated_at, user_id) VALUES (?, 't', 'b', '[]', '2026', '2026', ?)").bind(`n-${old}`, old).run();
  await db.prepare("INSERT INTO kv (user_id, key, value, updated_at) VALUES (?, 'progress', '{}', 1)").bind(old).run();
  await db.prepare("INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth) VALUES (?, ?, 'k', 'a')").bind(`https://p/${old}`, old).run();
  await db.prepare("INSERT INTO reminders (user_id, course_id, title, time, tz) VALUES (?, 'c', 'T', '09:00', 'UTC')").bind(old).run();
};
const owners = async (db: ReturnType<typeof memoryDb>, t: string) =>
  (await db.prepare(`SELECT user_id FROM ${t} ORDER BY user_id`).all<{ user_id: string }>()).results.map((r) => r.user_id);

test("claimLegacy: verified email moves five tables, local and '' go to the first account only, collisions keep both rows", async () => {
  const { req, db } = setup();
  await seedLegacy(db, "ada@x.com");
  await seedLegacy(db, "local");
  await seedLegacy(db, "bob@x.com");
  await db.prepare("INSERT INTO kv (user_id, key, value, updated_at) VALUES ('', 'claimed', '\"ada@x.com\"', 0)").run(); // old marker
  const first = await signUp(req, "zed@x.com");
  // first account, unverified: gets local and '' but no email
  expect((await (await req("/me", { headers: { cookie: first.cookie } })).json() as Me).aliases).toEqual(["", "local"]);
  expect(await owners(db, "notes")).toEqual(["ada@x.com", "bob@x.com", first.id].sort());

  const ada = await signUp(req, "ada@x.com");
  await db.prepare(`UPDATE "user" SET "emailVerified" = 1 WHERE id = ?`).bind(ada.id).run();
  // a new-device progress row pushed before the claim collides with the legacy one
  await db.prepare("INSERT INTO kv (user_id, key, value, updated_at) VALUES (?, 'progress', '{\"new\":1}', 2)").bind(ada.id).run();
  const me = (await (await req("/me", { headers: { cookie: ada.cookie } })).json()) as Me;
  expect(me.aliases).toEqual(["ada@x.com"]);
  for (const t of ["answers", "notes", "push_subscriptions", "reminders"]) expect(await owners(db, t)).toEqual(["bob@x.com", first.id, ada.id].sort());
  expect(await db.prepare("SELECT value FROM kv WHERE user_id = ? AND key = 'progress'").bind(ada.id).first()).toEqual({ value: '{"new":1}' });
  expect(await db.prepare("SELECT 1 AS x FROM kv WHERE user_id = 'ada@x.com' AND key = 'progress'").first()).toEqual({ x: 1 });
  expect(await db.prepare("SELECT user_id FROM kv WHERE key = 'claimed'").first()).toEqual({ user_id: "" });
});

test("claimLegacy is idempotent across restarts", async () => {
  const { req, db } = setup();
  await seedLegacy(db, "local");
  const a = await signUp(req, "a@x.com");
  await req("/me", { headers: { cookie: a.cookie } });
  // a second process on the same DB: the in-memory cache is new, the claims table is not
  const deps = defaultDeps({ fetch: fakeFetch });
  deps.session = sessionFrom(createAuth(env, db.sqlite, deps));
  const app = new Hono<{ Bindings: Env }>().route("/api", createApi(deps));
  await seedLegacy(db, "late");
  await db.prepare("UPDATE notes SET user_id = 'local' WHERE user_id = 'late'").run();
  const b = await signUp(req, "b@x.com");
  const res = await app.request("http://localhost/api/me", { headers: { cookie: b.cookie } }, env);
  expect(((await res.json()) as Me).aliases).toEqual([]);
  expect(await db.prepare("SELECT count(*) AS n FROM legacy_claims").first()).toEqual({ n: 2 });
  expect(await owners(db, "notes")).toContain("local"); // rows that appear under a claimed id later stay put
});

test("x-api-key works on GET /notes* only", async () => {
  const { req } = setup();
  const { cookie } = await signUp(req);
  const res = await req("/auth/api-key/create", post({ name: "mcp" }, { cookie }));
  expect(res.status).toBe(200);
  const { key } = (await res.json()) as { key: string };
  expect((await req("/notes", { headers: { "x-api-key": key } })).status).toBe(200);
  expect((await req("/notes/missing", { headers: { "x-api-key": key } })).status).toBe(404);
  expect((await req("/me", { headers: { "x-api-key": key } })).status).toBe(401);
  expect((await req("/notes", post({ title: "t", body: "", tags: [] }, { "x-api-key": key }))).status).toBe(401);
  expect((await req("/auth/list-sessions", { headers: { "x-api-key": key } })).status).toBe(401);
  expect((await req("/auth/api-key/create", post({ name: "more" }, { "x-api-key": key }))).status).toBe(401);
});

test("delete-user cancels billing and purges every table", async () => {
  const { req, db } = setup();
  const { cookie, id } = await signUp(req);
  await req("/me", { headers: { cookie } });
  await seedLegacy(db, id);
  const res = await req("/auth/delete-user", post({}, { cookie }));
  expect(res.status).toBe(200);
  expect(cancelForUser).toHaveBeenCalledWith(db, env, expect.anything(), id);
  for (const t of ["answers", "notes", "push_subscriptions", "reminders"]) expect(await owners(db, t)).toEqual([]);
  expect(await db.prepare(`SELECT count(*) AS n FROM "user"`).first()).toEqual({ n: 0 });
  expect((await req("/me", { headers: { cookie } })).status).toBe(401);
});

test("apple client secret is an ES256 JWT for the client id", () => {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const jwt = appleSecret({ APPLE_CLIENT_ID: "app.questie.web", APPLE_TEAM_ID: "TEAM", APPLE_KEY_ID: "KEY", APPLE_PRIVATE_KEY: pem.replace(/\n/g, "\\n") }, new Date(0));
  const [h, b, s] = jwt.split(".");
  expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "ES256", kid: "KEY" });
  expect(JSON.parse(Buffer.from(b, "base64url").toString())).toEqual({ iss: "TEAM", iat: 0, exp: 180 * 86400, aud: "https://appleid.apple.com", sub: "app.questie.web" });
  const ok = verify("sha256", Buffer.from(`${h}.${b}`), { key: createPublicKey(privateKey), dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
  expect(ok).toBe(true);
});
