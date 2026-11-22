import { Hono, type Context, type MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import Anthropic from "@anthropic-ai/sdk";
import Stripe from "stripe";
import type { Grade, Health, Improvement, Note, Profile, NoteInput, PushSubscriptionInput, Reminder, SavedAnswer } from "../shared/api-types";
import { toMarkdown } from "../shared/export";
import { BUILD } from "../shared/pricing";
import { COURSES, courseOf, type Course } from "../src/course/registry";
import { validZone } from "./reminders";
import { claudeGrader, claudeImprover, parseGrade, type GradeInput, type Grader } from "./grader";
import type { Env } from "./env";
import { err } from "./errors";
import { limit } from "./limits";
import { authRoutes, meRoutes } from "./auth";
import { billingPublic, billingRoutes } from "./credits";
import { coursesRoutes } from "./courses";
import { sandboxRun, type KataRunner } from "./sandbox";
import { gradingRoutes } from "./grading";
import { narrationRoutes } from "./narration";
import { builderRoutes } from "./builder";
import { libraryRoutes } from "./library";
import { devicesRoutes } from "./devices";

export type { Db, Stmt } from "./db";
export type { Env } from "./env";

/** The signed-in account as the session lookup returns it. */
export interface SessionUser { id: string; email: string; name: string; emailVerified: boolean; image?: string | null }
export type App = { Bindings: Env; Variables: { user: string; account: SessionUser; appOrigin?: boolean } };

/** Stronger answer + corrections for a graded answer. */
export type Improver = (input: GradeInput & { grade: Grade }) => Promise<Improvement>;

/** Everything a route needs from outside; tests replace any of it. */
export interface Deps {
  courses: Course[];
  session(c: Context<App>): Promise<SessionUser | null>;
  grader(env: Env): Grader | null;
  improver(env: Env): Improver | null;
  anthropic(env: Env): Anthropic | null; // builder, topic pre-check
  stripe(env: Env): Stripe | null;
  fetch: typeof fetch; // ElevenLabs, Resend, FCM
  sandbox: KataRunner;
  now(): Date;
}

export const defaultDeps = (over: Partial<Deps> = {}): Deps => ({
  courses: COURSES,
  session: async () => null, // server/index.ts sets the Better Auth lookup
  grader: (env) => (env.ANTHROPIC_API_KEY ? claudeGrader(env.ANTHROPIC_API_KEY) : null),
  improver: (env) => (env.ANTHROPIC_API_KEY ? claudeImprover(env.ANTHROPIC_API_KEY) : null),
  anthropic: (env) => (env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null),
  stripe: (env) => (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET ? new Stripe(env.STRIPE_SECRET_KEY) : null),
  fetch: (...a) => fetch(...a),
  sandbox: sandboxRun,
  now: () => new Date(),
  ...over,
});

export const MAX_ANSWER = 8000;
const MAX_TEXT = 20000;
export const MAX_NOTE = 100_000;
const SOURCES = ["typed", "dictated", "mixed"] as const;

export const str = (v: unknown, max: number, min = 0): v is string => typeof v === "string" && v.trim().length >= min && v.length <= max;
export const qualified = (v: unknown): v is string => str(v, 200, 1) && /^[^:]+:./.test(v);

function parseSave(v: unknown): Omit<SavedAnswer, "id" | "createdAt"> | string {
  const b = (v ?? {}) as Record<string, unknown>;
  if (!qualified(b.challengeId)) return "Invalid challengeId";
  if (!str(b.levelId, 200, 1)) return "Invalid levelId";
  if (!str(b.prompt, MAX_TEXT, 1)) return "Invalid prompt";
  if (!str(b.answer, MAX_ANSWER, 1)) return `Answer must be 1 to ${MAX_ANSWER} characters`;
  if (!SOURCES.includes(b.source as never)) return "Invalid source";
  if (b.seconds !== undefined && (typeof b.seconds !== "number" || !(b.seconds >= 0) || b.seconds > 86400)) return "Invalid seconds";
  const grade = b.grade === undefined ? undefined : parseGrade(b.grade);
  if (grade === null) return "Invalid grade";
  if (b.selfScore !== undefined && !(Number.isInteger(b.selfScore) && (b.selfScore as number) >= 0 && (b.selfScore as number) <= 10)) return "Invalid selfScore";
  return {
    challengeId: b.challengeId, levelId: b.levelId, prompt: b.prompt, answer: b.answer,
    source: b.source as SavedAnswer["source"],
    ...(b.seconds !== undefined && { seconds: Math.round(b.seconds as number) }),
    ...(grade && { grade }),
    ...(b.selfScore !== undefined && { selfScore: b.selfScore as number }),
  };
}

function parseNote(v: unknown): NoteInput | string {
  const b = (v ?? {}) as Record<string, unknown>;
  if (!str(b.title, 200, 1)) return "Title must be 1 to 200 characters";
  if (!str(b.body, MAX_NOTE)) return `Body must be under ${MAX_NOTE} characters`;
  if (!Array.isArray(b.tags) || b.tags.length > 20 || !b.tags.every((t) => str(t, 40, 1))) return "Up to 20 tags of 1 to 40 characters";
  if (b.courseId != null && !str(b.courseId, 100, 1)) return "Invalid courseId";
  return {
    title: b.title.trim(), body: b.body, tags: [...new Set((b.tags as string[]).map((t) => t.trim()))],
    ...(b.courseId != null && { courseId: b.courseId as string }),
  };
}

const PROFILE_MAX = { name: 100, title: 100, location: 100, link: 300, bio: 2000 } as const;
function parseProfile(v: unknown): Profile | string {
  const b = (v ?? {}) as Record<string, unknown>;
  const out = {} as Profile;
  for (const [k, max] of Object.entries(PROFILE_MAX) as [keyof Profile, number][]) {
    if (!str(b[k], max)) return `${k} must be under ${max} characters`;
    out[k] = (b[k] as string).trim();
  }
  if (out.link && !/^https?:\/\//i.test(out.link)) return "link must start with http:// or https://";
  return out;
}

function parseSubscription(v: unknown): PushSubscriptionInput | string {
  const b = (v ?? {}) as Record<string, unknown>;
  if (!str(b.endpoint, 2000, 1) || !/^https:\/\//.test(b.endpoint)) return "Invalid endpoint";
  if (!str(b.p256dh, 200, 1) || !str(b.auth, 200, 1)) return "Invalid keys";
  return { endpoint: b.endpoint, p256dh: b.p256dh, auth: b.auth };
}

function parseReminder(v: unknown): Reminder | string {
  const b = (v ?? {}) as Record<string, unknown>;
  if (!str(b.courseId, 100, 1)) return "Invalid courseId";
  if (!str(b.title, 200, 1)) return "Invalid title";
  if (typeof b.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time)) return "Invalid time";
  if (!str(b.tz, 100, 1) || !validZone(b.tz)) return "Invalid tz";
  return { courseId: b.courseId as string, title: b.title.trim(), time: b.time, tz: b.tz };
}

type AnswerRow = {
  id: string; challenge_id: string; level_id: string; prompt: string; answer: string; source: SavedAnswer["source"];
  seconds: number | null; grade: string | null; self_score: number | null; created_at: string;
};
const toAnswer = (r: AnswerRow): SavedAnswer => ({
  id: r.id, challengeId: r.challenge_id, levelId: r.level_id, prompt: r.prompt, answer: r.answer, source: r.source,
  ...(r.seconds != null && { seconds: r.seconds }),
  ...(r.grade && { grade: JSON.parse(r.grade) as Grade }),
  ...(r.self_score != null && { selfScore: r.self_score }),
  createdAt: r.created_at,
});

type NoteRow = { id: string; title: string; body: string; tags: string; course_id: string | null; created_at: string; updated_at: string };
const toNote = (r: NoteRow): Note => ({
  id: r.id, title: r.title, body: r.body, tags: JSON.parse(r.tags), ...(r.course_id && { courseId: r.course_id }),
  createdAt: r.created_at, updatedAt: r.updated_at,
});

const JSON_WRITE = new Set(["POST", "PUT", "PATCH"]);

/**
 * Only this app's own pages and the native apps may call the API. Cross-site or foreign-origin requests pass only from an
 * APP_ORIGINS origin, which then authenticates by bearer only (appOrigin). Writes must be JSON, except multipart uploads.
 */
const SCRIPT_DESTS = new Set(["script", "json", "style", "worker", "sharedworker", "serviceworker"]);
/** Kata code from courses runs in a worker without fetch; a module or JSON import is the read it has left. Before /auth/*, which returns session tokens. */
const noImports: MiddlewareHandler<App> = async (c, next) => {
  if (SCRIPT_DESTS.has(c.req.header("sec-fetch-dest") ?? "")) return err(c, 403, "origin_not_allowed");
  await next();
};
const guard: MiddlewareHandler<App> = async (c, next) => {
  const origin = c.req.header("origin");
  const appOrigin = !!origin && c.env.APP_ORIGINS.includes(origin);
  const site = c.req.header("sec-fetch-site");
  let foreign = !!site && site !== "same-origin" && site !== "none";
  if (origin) {
    try { if (new URL(origin).host !== new URL(c.req.url).host) foreign = true; } catch { foreign = true; }
  }
  if (foreign && !appOrigin) return err(c, 403, "origin_not_allowed");
  if (appOrigin) c.set("appOrigin", true);
  const upload = c.req.method === "POST" && c.req.path.endsWith("/builder/uploads");
  if (JSON_WRITE.has(c.req.method) && !upload && !/^application\/json\b/i.test(c.req.header("content-type") ?? "")) {
    return err(c, 415, "unsupported_media_type", {}, "Content-Type must be application/json");
  }
  await next();
};

const tooLarge = (c: Context) => err(c, 413, "too_large");
const limits = {
  upload: bodyLimit({ maxSize: BUILD.uploadMaxBytes + 64 * 1024, onError: tooLarge }), // file plus multipart framing
  course: bodyLimit({ maxSize: 2 * 1024 * 1024, onError: tooLarge }),
  other: bodyLimit({ maxSize: 256 * 1024, onError: tooLarge }),
};
/** 256 KB, except uploads (20 MB) and course re-uploads (2 MB). */
const limitBody: MiddlewareHandler<App> = (c, next) => {
  const p = c.req.path, m = c.req.method;
  const l = m === "POST" && p.endsWith("/builder/uploads") ? limits.upload : m === "PUT" && /\/courses\/[^/]+$/.test(p) ? limits.course : limits.other;
  return l(c, next);
};

/**
 * Mount order (Hono runs in registration order): cors -> noImports -> /health -> body limits for /auth/* and /webhooks/* -> /auth/* -> /webhooks/* -> guard -> session -> limitBody -> the rest.
 * Route modules are mounted with .route("/", ...); they must scope every middleware to a path (no path-less .use()),
 * or it would run for every later route.
 */
export function createApi(over: Partial<Deps> = {}): Hono<App> {
  const deps = defaultDeps(over);
  const { grader } = deps;
  const session: MiddlewareHandler<App> = async (c, next) => {
    const u = await deps.session(c);
    if (!u) return err(c, 401, "unauthorized");
    c.set("user", u.id);
    c.set("account", u);
    await next();
  };
  const json = async (c: Context<App>) => c.req.json().catch(() => undefined);
  const db = (c: Context<App>) => c.env.DB;
  const user = (c: Context<App>) => c.get("user");
  const listAnswers = async (c: Context<App>, challengeId?: string) => {
    const stmt = db(c).prepare(`SELECT * FROM answers WHERE user_id = ? ${challengeId ? "AND challenge_id = ?" : ""} ORDER BY created_at DESC, rowid DESC`);
    const { results } = await stmt.bind(...(challengeId ? [user(c), challengeId] : [user(c)])).all<AnswerRow>();
    return results.map(toAnswer);
  };
  const getNote = async (c: Context<App>, id: string) => {
    const row = await db(c).prepare("SELECT * FROM notes WHERE id = ? AND user_id = ?").bind(id, user(c)).first<NoteRow>();
    return row && toNote(row);
  };

  return new Hono<App>()
    .use(cors({
      origin: (o, c) => (c.env.APP_ORIGINS.includes(o) ? o : null),
      allowHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
      exposeHeaders: ["set-auth-token", "x-credits-balance", "Retry-After"],
      maxAge: 600,
    }))
    .use(noImports)
    .get("/health", (c) => c.json({
      ok: true, commit: c.env.COMMIT, grader: grader(c.env) !== null, narration: !!c.env.ELEVENLABS_API_KEY,
    } satisfies Health))
    .use("/auth/*", limits.other) // public routes, so before limitBody
    .use("/webhooks/*", limits.other)
    .route("/", authRoutes(deps))
    .route("/", billingPublic(deps))
    .use(guard)
    .use(session)
    .use(limitBody)
    // Rate limits per user (docs/design/questie.md 3.2); the handlers live in the route modules below.
    .post("/grade", limit("grade", 30, 60))
    .post("/answers/:id/improve", limit("improve", 30, 60))
    .post("/mock", limit("mock", 10, 3600))
    .post("/builder/jobs", limit("builder_jobs", 10, 3600))
    .post("/builder/uploads", limit("builder_uploads", 30, 3600))
    .post("/narration", limit("narration", 60, 3600))
    .put("/courses/:id", limit("course_put", 20, 3600))
    .post("/billing/checkout", limit("billing", 20, 3600))
    .post("/billing/portal", limit("billing", 20, 3600))
    .post("/flags", limit("flags", 30, 3600))
    .route("/", meRoutes(deps))
    .get("/profile", async (c) => {
      const row = await db(c).prepare("SELECT value FROM kv WHERE user_id = ? AND key = 'profile'").bind(user(c)).first<{ value: string }>();
      return c.json({ name: "", title: "", location: "", link: "", bio: "", ...(row && JSON.parse(row.value)) } satisfies Profile);
    })
    .put("/profile", async (c) => {
      const p = parseProfile(await json(c));
      if (typeof p === "string") return err(c, 400, "invalid_request", {}, p);
      await db(c).prepare(
        `INSERT INTO kv (user_id, key, value, updated_at) VALUES (?, 'profile', ?, ?)
         ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      ).bind(user(c), JSON.stringify(p), Date.now()).run();
      return c.json(p);
    })
    .get("/push/key", (c) => c.env.VAPID_PUBLIC ? c.json({ key: c.env.VAPID_PUBLIC }) : err(c, 503, "not_configured", {}, "Reminders not configured"))
    .post("/push/subscription", async (c) => {
      const sub = parseSubscription(await json(c));
      if (typeof sub === "string") return err(c, 400, "invalid_request", {}, sub);
      await db(c).prepare(
        `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth) VALUES (?, ?, ?, ?)
         ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
      ).bind(sub.endpoint, user(c), sub.p256dh, sub.auth).run();
      return c.body(null, 204);
    })
    .delete("/push/subscription", async (c) => {
      const b = ((await json(c)) ?? {}) as Record<string, unknown>;
      if (!str(b.endpoint, 2000, 1)) return err(c, 400, "invalid_request", {}, "Invalid endpoint");
      await db(c).prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?").bind(b.endpoint, user(c)).run();
      return c.body(null, 204);
    })
    .get("/reminders", async (c) => {
      const { results } = await db(c).prepare("SELECT course_id, title, time, tz FROM reminders WHERE user_id = ? ORDER BY course_id").bind(user(c))
        .all<{ course_id: string; title: string; time: string; tz: string }>();
      return c.json(results.map((r) => ({ courseId: r.course_id, title: r.title, time: r.time, tz: r.tz }) satisfies Reminder));
    })
    .put("/reminders", async (c) => {
      const r = parseReminder(await json(c));
      if (typeof r === "string") return err(c, 400, "invalid_request", {}, r);
      await db(c).prepare(
        `INSERT INTO reminders (user_id, course_id, title, time, tz) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, course_id) DO UPDATE SET title = excluded.title, time = excluded.time, tz = excluded.tz, last_sent = ''`,
      ).bind(user(c), r.courseId, r.title, r.time, r.tz).run();
      return c.json(r);
    })
    .delete("/reminders/:course", async (c) => {
      await db(c).prepare("DELETE FROM reminders WHERE user_id = ? AND course_id = ?").bind(user(c), c.req.param("course")).run();
      return c.body(null, 204);
    })
    .post("/answers", async (c) => {
      const body = parseSave(await json(c));
      if (typeof body === "string") return err(c, 400, "invalid_request", {}, body);
      const a: SavedAnswer = { id: crypto.randomUUID(), ...body, createdAt: new Date().toISOString() };
      await db(c).prepare(
        `INSERT INTO answers (id, course_id, challenge_id, level_id, prompt, answer, source, seconds, grade, self_score, created_at, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        a.id, courseOf(a.challengeId), a.challengeId, a.levelId, a.prompt, a.answer, a.source,
        a.seconds ?? null, a.grade ? JSON.stringify(a.grade) : null, a.selfScore ?? null, a.createdAt, user(c),
      ).run();
      return c.json(a, 201);
    })
    .get("/answers", async (c) => c.json(await listAnswers(c, c.req.query("challengeId"))))
    .get("/export", async (c) => {
      c.header("Content-Type", "text/markdown; charset=utf-8");
      c.header("Content-Disposition", 'attachment; filename="answers.md"');
      return c.body(toMarkdown(await listAnswers(c)));
    })
    .get("/progress", async (c) => {
      const row = await db(c).prepare("SELECT value, updated_at FROM kv WHERE user_id = ? AND key = 'progress'").bind(user(c)).first<{ value: string; updated_at: number }>();
      return row ? c.json({ value: JSON.parse(row.value), updatedAt: row.updated_at }) : err(c, 404, "not_found", {}, "No progress");
    })
    .put("/progress", async (c) => {
      const b = ((await json(c)) ?? {}) as Record<string, unknown>;
      if (!b.value || typeof b.value !== "object" || Array.isArray(b.value)) return err(c, 400, "invalid_request", {}, "Invalid value");
      if (!Number.isSafeInteger(b.updatedAt) || (b.updatedAt as number) < 0) return err(c, 400, "invalid_request", {}, "Invalid updatedAt");
      const { meta } = await db(c).prepare(
        `INSERT INTO kv (user_id, key, value, updated_at) VALUES (?, 'progress', ?, ?)
         ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at WHERE excluded.updated_at > kv.updated_at`,
      ).bind(user(c), JSON.stringify(b.value), b.updatedAt).run();
      return c.json({ stored: meta.changes > 0 });
    })
    .get("/notes", async (c) => {
      const { results } = await db(c).prepare(
        `SELECT * FROM notes
         WHERE user_id = ?3 AND (?1 = '' OR instr(lower(title), lower(?1)) > 0 OR instr(lower(body), lower(?1)) > 0)
           AND (?2 = '' OR EXISTS (SELECT 1 FROM json_each(notes.tags) WHERE value = ?2))
         ORDER BY updated_at DESC, rowid DESC`,
      ).bind(c.req.query("q")?.trim() ?? "", c.req.query("tag") ?? "", user(c)).all<NoteRow>();
      return c.json(results.map(toNote));
    })
    .get("/notes/:id", async (c) => {
      const note = await getNote(c, c.req.param("id"));
      return note ? c.json(note) : err(c, 404, "not_found", {}, "Note not found");
    })
    .post("/notes", async (c) => {
      const n = parseNote(await json(c));
      if (typeof n === "string") return err(c, 400, "invalid_request", {}, n);
      const now = new Date().toISOString();
      const note: Note = { id: crypto.randomUUID(), ...n, createdAt: now, updatedAt: now };
      await db(c).prepare("INSERT INTO notes (id, title, body, tags, course_id, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(note.id, note.title, note.body, JSON.stringify(note.tags), note.courseId ?? null, now, now, user(c)).run();
      return c.json(note, 201);
    })
    .put("/notes/:id", async (c) => {
      const n = parseNote(await json(c));
      if (typeof n === "string") return err(c, 400, "invalid_request", {}, n);
      const id = c.req.param("id");
      const { meta } = await db(c).prepare("UPDATE notes SET title = ?, body = ?, tags = ?, course_id = ?, updated_at = ? WHERE id = ? AND user_id = ?")
        .bind(n.title, n.body, JSON.stringify(n.tags), n.courseId ?? null, new Date().toISOString(), id, user(c)).run();
      return meta.changes ? c.json((await getNote(c, id))!) : err(c, 404, "not_found", {}, "Note not found");
    })
    .delete("/notes/:id", async (c) => {
      const { meta } = await db(c).prepare("DELETE FROM notes WHERE id = ? AND user_id = ?").bind(c.req.param("id"), user(c)).run();
      return meta.changes ? c.body(null, 204) : err(c, 404, "not_found", {}, "Note not found");
    })
    .route("/", gradingRoutes(deps))
    .route("/", narrationRoutes(deps))
    .route("/", builderRoutes(deps))
    .route("/", coursesRoutes(deps))
    .route("/", libraryRoutes(deps))
    .route("/", billingRoutes(deps))
    .route("/", devicesRoutes(deps))
    // A route, not notFound(): mounted with app.route, a sub-app's notFound is ignored.
    .all("*", (c) => err(c, 404, "not_found"));
}
