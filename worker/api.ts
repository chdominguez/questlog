import { Hono, type Context, type MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Grade, Note, NoteInput, SavedAnswer } from "../shared/api-types";
import { toMarkdown } from "../shared/export";
import { COURSES, courseOf, type Course } from "../src/course/registry";
import { claudeGrader, parseGrade, type Grader } from "./grader";

// shortcut: hand-written subset of D1's types; @cloudflare/workers-types' globals clash with the DOM lib in the shared tsconfig.
export interface D1Stmt {
  bind(...values: unknown[]): D1Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface D1 { prepare(sql: string): D1Stmt }

export interface Env {
  DB: D1;
  ANTHROPIC_API_KEY?: string;
  ACCESS_TEAM_DOMAIN?: string; // e.g. myteam.cloudflareaccess.com
  ACCESS_AUD?: string; // Access application audience tag
  AUTH_DISABLED?: string; // "1" only in .dev.vars
}

/** Resolves true, or throws / resolves false, when the Access JWT is not valid for this app. */
export type Verifier = (token: string, env: Env) => Promise<boolean>;

const jwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export const accessVerifier: Verifier = async (token, env) => {
  const issuer = `https://${env.ACCESS_TEAM_DOMAIN!.replace(/^https:\/\/|\/+$/g, "")}`;
  let keys = jwks.get(issuer);
  if (!keys) jwks.set(issuer, (keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`))));
  await jwtVerify(token, keys, { issuer, audience: env.ACCESS_AUD });
  return true;
};

export const MAX_ANSWER = 8000;
const MAX_TEXT = 20000;
export const MAX_NOTE = 100_000;
const SOURCES = ["typed", "dictated", "mixed"] as const;

const str = (v: unknown, max: number, min = 0): v is string => typeof v === "string" && v.trim().length >= min && v.length <= max;
const qualified = (v: unknown): v is string => str(v, 200, 1) && /^[^:]+:./.test(v);

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

type App = { Bindings: Env };

/** Every /api call needs a valid Access JWT; AUTH_DISABLED=1 (local .dev.vars only) skips it. No AUD configured fails closed. */
const auth = (verify: Verifier): MiddlewareHandler<App> => async (c, next) => {
  if (c.env.AUTH_DISABLED === "1") return next();
  const token = c.req.header("cf-access-jwt-assertion");
  const ok = !!token && !!c.env.ACCESS_AUD && !!c.env.ACCESS_TEAM_DOMAIN && (await verify(token, c.env).catch(() => false));
  if (!ok) return c.json({ error: "Unauthorized" }, 401);
  await next();
};

/** Only this app's own pages may call the API: blocks cross-site requests riding the Access cookie, and simple (text/plain) writes. */
const guard: MiddlewareHandler<App> = async (c, next) => {
  const site = c.req.header("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return c.json({ error: "Origin not allowed" }, 403);
  const origin = c.req.header("origin");
  if (origin) {
    let ok = false;
    try { ok = new URL(origin).host === new URL(c.req.url).host; } catch { /* malformed */ }
    if (!ok) return c.json({ error: "Origin not allowed" }, 403);
  }
  if ((c.req.method === "POST" || c.req.method === "PUT") && !/^application\/json\b/i.test(c.req.header("content-type") ?? "")) {
    return c.json({ error: "Content-Type must be application/json" }, 415);
  }
  await next();
};

/** The written challenge with this qualified id and its course, or the status to answer with. */
function written(courses: Course[], id: string) {
  const course = courses.find((c) => c.id === courseOf(id));
  const ch = course?.levels.flatMap((l) => l.challenges).find((x) => x.id === id);
  if (!course || !ch) return 404;
  return ch.type === "written" ? { course, ch } : 400;
}

export function createApi({
  verify = accessVerifier,
  grader = (env: Env) => (env.ANTHROPIC_API_KEY ? claudeGrader(env.ANTHROPIC_API_KEY) : null),
  courses = COURSES,
}: { verify?: Verifier; grader?: (env: Env) => Grader | null; courses?: Course[] } = {}) {
  const json = async (c: Context<App>) => c.req.json().catch(() => undefined);
  const db = (c: Context<App>) => c.env.DB;
  const listAnswers = async (c: Context<App>, challengeId?: string) => {
    const stmt = db(c).prepare(`SELECT * FROM answers ${challengeId ? "WHERE challenge_id = ?" : ""} ORDER BY created_at DESC, rowid DESC`);
    const { results } = await (challengeId ? stmt.bind(challengeId) : stmt).all<AnswerRow>();
    return results.map(toAnswer);
  };
  const getNote = async (c: Context<App>, id: string) => {
    const row = await db(c).prepare("SELECT * FROM notes WHERE id = ?").bind(id).first<NoteRow>();
    return row && toNote(row);
  };

  return new Hono<App>()
    .use(auth(verify))
    .use(guard)
    .use(bodyLimit({ maxSize: 256 * 1024, onError: (c) => c.json({ error: "Request too large" }, 413) }))
    .get("/health", (c) => c.json({ ok: true, grader: grader(c.env) !== null }))
    .post("/grade", async (c) => {
      const grade = grader(c.env);
      if (!grade) return c.json({ error: "Grader not configured (missing ANTHROPIC_API_KEY)" }, 503);
      const b = ((await json(c)) ?? {}) as Record<string, unknown>;
      if (!qualified(b.challengeId)) return c.json({ error: "Invalid challengeId" }, 400);
      if (!str(b.answer, MAX_ANSWER, 1)) return c.json({ error: `Answer must be 1 to ${MAX_ANSWER} characters` }, 400);
      const found = written(courses, b.challengeId);
      if (found === 404) return c.json({ error: "Unknown challenge" }, 404);
      if (found === 400) return c.json({ error: "Not a written challenge" }, 400);
      const { course, ch } = found;
      try {
        return c.json(await grade({
          prompt: ch.prompt, model: ch.model, keyPoints: ch.keyPoints, answer: b.answer, lang: course.lang, persona: course.grader?.persona,
        }));
      } catch (e) {
        console.error("grade failed:", e);
        return c.json({ error: "Grader failed" }, 502);
      }
    })
    .post("/answers", async (c) => {
      const body = parseSave(await json(c));
      if (typeof body === "string") return c.json({ error: body }, 400);
      const a: SavedAnswer = { id: crypto.randomUUID(), ...body, createdAt: new Date().toISOString() };
      await db(c).prepare("INSERT INTO answers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(
        a.id, courseOf(a.challengeId), a.challengeId, a.levelId, a.prompt, a.answer, a.source,
        a.seconds ?? null, a.grade ? JSON.stringify(a.grade) : null, a.selfScore ?? null, a.createdAt,
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
      const row = await db(c).prepare("SELECT value, updated_at FROM kv WHERE key = 'progress'").first<{ value: string; updated_at: number }>();
      return row ? c.json({ value: JSON.parse(row.value), updatedAt: row.updated_at }) : c.json({ error: "No progress" }, 404);
    })
    .put("/progress", async (c) => {
      const b = ((await json(c)) ?? {}) as Record<string, unknown>;
      if (!b.value || typeof b.value !== "object" || Array.isArray(b.value)) return c.json({ error: "Invalid value" }, 400);
      if (!Number.isSafeInteger(b.updatedAt) || (b.updatedAt as number) < 0) return c.json({ error: "Invalid updatedAt" }, 400);
      const { meta } = await db(c).prepare(
        `INSERT INTO kv (key, value, updated_at) VALUES ('progress', ?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at WHERE excluded.updated_at > kv.updated_at`,
      ).bind(JSON.stringify(b.value), b.updatedAt).run();
      return c.json({ stored: meta.changes > 0 });
    })
    .get("/notes", async (c) => {
      const { results } = await db(c).prepare(
        `SELECT * FROM notes
         WHERE (?1 = '' OR instr(lower(title), lower(?1)) > 0 OR instr(lower(body), lower(?1)) > 0)
           AND (?2 = '' OR EXISTS (SELECT 1 FROM json_each(notes.tags) WHERE value = ?2))
         ORDER BY updated_at DESC, rowid DESC`,
      ).bind(c.req.query("q")?.trim() ?? "", c.req.query("tag") ?? "").all<NoteRow>();
      return c.json(results.map(toNote));
    })
    .get("/notes/:id", async (c) => {
      const note = await getNote(c, c.req.param("id"));
      return note ? c.json(note) : c.json({ error: "Note not found" }, 404);
    })
    .post("/notes", async (c) => {
      const n = parseNote(await json(c));
      if (typeof n === "string") return c.json({ error: n }, 400);
      const now = new Date().toISOString();
      const note: Note = { id: crypto.randomUUID(), ...n, createdAt: now, updatedAt: now };
      await db(c).prepare("INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(note.id, note.title, note.body, JSON.stringify(note.tags), note.courseId ?? null, now, now).run();
      return c.json(note, 201);
    })
    .put("/notes/:id", async (c) => {
      const n = parseNote(await json(c));
      if (typeof n === "string") return c.json({ error: n }, 400);
      const id = c.req.param("id");
      const { meta } = await db(c).prepare("UPDATE notes SET title = ?, body = ?, tags = ?, course_id = ?, updated_at = ? WHERE id = ?")
        .bind(n.title, n.body, JSON.stringify(n.tags), n.courseId ?? null, new Date().toISOString(), id).run();
      return meta.changes ? c.json((await getNote(c, id))!) : c.json({ error: "Note not found" }, 404);
    })
    .delete("/notes/:id", async (c) => {
      const { meta } = await db(c).prepare("DELETE FROM notes WHERE id = ?").bind(c.req.param("id")).run();
      return meta.changes ? c.body(null, 204) : c.json({ error: "Note not found" }, 404);
    })
    // A route, not notFound(): mounted with app.route, a sub-app's notFound is ignored.
    .all("*", (c) => c.json({ error: "Not found" }, 404));
}
