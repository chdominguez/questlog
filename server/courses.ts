import { Hono, type Context } from "hono";
import type { CourseMode, CourseStatus, UserCourseMeta } from "../shared/api-types";
import { CourseSchema, type CourseInput } from "../src/course/schema";
import { validateCourse } from "../src/course/validate";
import { COURSES, resolve, type Course } from "../src/course/registry";
import type { App, Deps } from "./api";
import type { Db } from "./db";
import { err } from "./errors";
import type { KataRunner } from "./sandbox";

export interface CourseRow {
  id: string; owner_id: string; title: string; lang: string; summary: string | null; json: string; version: number;
  status: CourseStatus; mode: CourseMode; levels: number; sources: number; review_note: string | null;
  updated_at: string; published_at: string | null; author: string | null;
}

/** Course rows with the author's name; append WHERE/ORDER. */
export const COURSE_SELECT = `SELECT c.*, u.name AS author FROM user_courses c LEFT JOIN "user" u ON u.id = c.owner_id`;
/** The same without the course JSON, for lists. Author is the Better Auth user name (table "user", migration 0004). */
export const COURSE_META = `SELECT c.id, c.owner_id, c.title, c.lang, c.summary, c.status, c.mode, c.levels, c.sources, c.version, c.review_note,
  c.updated_at, c.published_at, u.name AS author FROM user_courses c LEFT JOIN "user" u ON u.id = c.owner_id`;

export const toMeta = (r: CourseRow, user: string): UserCourseMeta => ({
  id: r.id, title: r.title, lang: r.lang, summary: r.summary, status: r.status, mine: r.owner_id === user, author: r.author ?? "",
  mode: r.mode, levels: r.levels, sources: r.sources, version: r.version, reviewNote: r.review_note, updatedAt: r.updated_at, publishedAt: r.published_at,
});

/** Owner always; any signed-in user unless private. */
export const canRead = (r: Pick<CourseRow, "owner_id" | "status">, user: string) => r.owner_id === user || r.status !== "private";

const cache = new Map<string, Course>(); // parsed course by id@version
function parsed(r: Pick<CourseRow, "id" | "version" | "json">): Course {
  const key = `${r.id}@${r.version}`;
  let c = cache.get(key);
  if (!c) {
    if (cache.size >= 200) cache.clear();
    cache.set(key, (c = resolve(CourseSchema.parse(JSON.parse(r.json)))));
  }
  return c;
}

/** Static COURSES first, then user_courses under the access rule. */
export async function findCourse(db: Db, id: string, user: string): Promise<Course | null> {
  const s = COURSES.find((c) => c.id === id);
  if (s) return s;
  const m = await db.prepare("SELECT owner_id, status, version FROM user_courses WHERE id = ?").bind(id).first<Pick<CourseRow, "owner_id" | "status" | "version">>();
  if (!m || !canRead(m, user)) return null;
  const hit = cache.get(`${id}@${m.version}`); // the JSON is read only on a miss
  if (hit) return hit;
  const r = await db.prepare("SELECT id, version, json FROM user_courses WHERE id = ?").bind(id).first<Pick<CourseRow, "id" | "version" | "json">>();
  return r && parsed(r);
}

/** `u<10 base36>-<slug>`: matches COURSE_DIR, and static ids never take this shape. */
export function newCourseId(slug: string): string {
  const s = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "course";
  for (;;) {
    const rnd = [...crypto.getRandomValues(new Uint8Array(10))].map((b) => (b % 36).toString(36)).join("");
    const id = `u${rnd}-${s}`;
    if (!COURSES.some((c) => c.id === id)) return id;
  }
}

/** Most characters a written challenge (with the course's grader persona) may send to the grader. */
export const GRADER_MAX_CHARS = 20_000;
export const graderChars = (ch: { prompt: string; model: string; keyPoints: string[] }, persona = "") =>
  ch.prompt.length + ch.model.length + ch.keyPoints.join("").length + persona.length;

const sourceCount = (c: CourseInput) => new Set(c.levels.flatMap((l) => l.theory.flatMap((t) => (t.sources ?? []).map((s) => s.url)))).size;

/** Saves a validated course for its owner (private); returns the course id. */
export async function saveUserCourse(db: Db, a: { owner: string; course: CourseInput; mode: CourseMode; sourceJobId?: string }): Promise<string> {
  const c = a.course;
  const t = new Date().toISOString();
  db.tx((q) => q.run(
    `INSERT INTO user_courses (id, owner_id, title, lang, summary, json, mode, levels, sources, source_job_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    c.id, a.owner, c.title, c.lang, c.summary ?? null, JSON.stringify(c), a.mode, c.levels.length, sourceCount(c), a.sourceJobId ?? null, t, t,
  ));
  return c.id;
}

/**
 * Builder rules on top of the schema (docs/design/questie-backend.md 8.3). `sources` is the set of URLs cards may cite
 * (empty: none; null: not checked, as on re-upload); `cite` requires sources on every card. Problems on a level start with `levels[i]`.
 */
export function builderProblems(c: CourseInput, sources: Set<string> | null, cite = false): string[] {
  const out: string[] = [];
  if (Object.keys(c.art ?? {}).length) out.push("art: inline art is not allowed"); // rendered inline for every viewer
  const types = new Set(c.levels.flatMap((l) => l.challenges.map((ch) => ch.type)));
  if (types.size < 3) out.push(`levels[0]: the course uses ${types.size} challenge type(s) (${[...types].join(", ")}); use at least 3 across the course, not only quiz and multi`);
  c.levels.forEach((l, li) => l.challenges.forEach((ch, ci) => {
    if (ch.type === "written" && graderChars(ch, c.grader?.persona) > GRADER_MAX_CHARS) out.push(`levels[${li}].challenges[${ci}]: prompt, model answer, key points and grader persona must total under ${GRADER_MAX_CHARS} characters`);
  }));
  c.levels.forEach((l, li) => l.theory.forEach((card, ti) => {
    card.blocks.forEach((b, bi) => { if (b.kind === "media") out.push(`levels[${li}].theory[${ti}].blocks[${bi}]: media blocks are not allowed`); });
    if (cite && !card.sources?.length) out.push(`levels[${li}].theory[${ti}].sources: cite at least one source from the list`);
    for (const s of card.sources ?? []) if (sources && !sources.has(s.url)) out.push(`levels[${li}].theory[${ti}].sources: "${s.url}" is not one of the given sources`);
  }));
  const used = new Set(c.levels.flatMap((l) => l.challenges.flatMap((ch) => (ch.type === "kata" ? [ch.kataId] : []))));
  (c.katas ?? []).forEach((k, i) => { if (!used.has(k.id)) out.push(`katas[${i}] (${k.id}): no kata challenge uses it`); });
  return out;
}

export const MAX_KATAS = 30;

/** Kata count (before any sandbox run), schema, sandboxed katas, then builder rules. */
export async function courseProblems(raw: unknown, run: KataRunner, sources: Set<string> | null, cite = false): Promise<string[]> {
  const katas = (raw as { katas?: unknown } | null)?.katas;
  if (Array.isArray(katas) && katas.length > MAX_KATAS) return [`katas: at most ${MAX_KATAS}`];
  const p = await validateCourse(raw, run);
  return p.length ? p : builderProblems(raw as CourseInput, sources, cite);
}

// Users with a PUT in the sandbox; one at a time, so one account can't hold every shared sandbox slot.
const validating = new Set<string>();

/** GET /courses (own + opened by link), GET/PUT/DELETE /courses/:id. */
export function coursesRoutes(deps: Deps): Hono<App> {
  const row = (c: Context<App>) => c.env.DB.prepare(`${COURSE_SELECT} WHERE c.id = ?`).bind(c.req.param("id")).first<CourseRow>();
  return new Hono<App>()
    .get("/courses", async (c) => {
      const user = c.get("user");
      const { results } = await c.env.DB.prepare(
        `${COURSE_META} WHERE c.owner_id = ?1 OR (c.status != 'private' AND c.id IN (SELECT course_id FROM course_opens WHERE user_id = ?1))
         ORDER BY c.updated_at DESC`,
      ).bind(user).all<CourseRow>();
      return c.json(results.map((r) => toMeta(r, user)));
    })
    .get("/courses/:id", async (c) => {
      const r = await row(c);
      const user = c.get("user");
      if (!r || !canRead(r, user)) return err(c, 404, "not_found");
      if (r.owner_id !== user) {
        c.env.DB.tx((q) => q.run(
          "INSERT INTO course_opens (user_id, course_id, opened_at) VALUES (?, ?, ?) ON CONFLICT (user_id, course_id) DO UPDATE SET opened_at = excluded.opened_at",
          user, r.id, new Date().toISOString(),
        ));
      }
      c.header("ETag", `"v${r.version}"`);
      return c.body(r.json, 200, { "Content-Type": "application/json" });
    })
    .put("/courses/:id", async (c) => {
      const r = await row(c);
      const user = c.get("user");
      if (!r || !canRead(r, user)) return err(c, 404, "not_found");
      if (r.owner_id !== user) return err(c, 403, "forbidden");
      const body = await c.req.json().catch(() => undefined) as Record<string, unknown> | undefined;
      if (!body || typeof body !== "object" || body.id !== r.id) return err(c, 422, "course_invalid", { problems: [`id: must be "${r.id}"`] });
      delete body.users;
      if (validating.has(user)) return err(c, 409, "in_progress");
      validating.add(user);
      const problems = await courseProblems(body, deps.sandbox, null).finally(() => validating.delete(user));
      if (problems.length) return err(c, 422, "course_invalid", { problems });
      const course = body as CourseInput;
      c.env.DB.tx((q) => q.run(
        `UPDATE user_courses SET title = ?, lang = ?, summary = ?, json = ?, levels = ?, sources = ?, version = version + 1, updated_at = ?,
           status = CASE status WHEN 'public' THEN 'pending' ELSE status END
         WHERE id = ?`,
        course.title, course.lang, course.summary ?? null, JSON.stringify(course), course.levels.length, sourceCount(course), new Date().toISOString(), r.id,
      ));
      return c.json(toMeta((await row(c))!, user));
    })
    .delete("/courses/:id", async (c) => {
      const r = await row(c);
      const user = c.get("user");
      if (!r || !canRead(r, user)) return err(c, 404, "not_found");
      if (r.owner_id !== user) return err(c, 403, "forbidden");
      c.env.DB.tx((q) => { q.run("DELETE FROM user_courses WHERE id = ?", r.id); q.run("DELETE FROM course_opens WHERE course_id = ?", r.id); });
      return c.body(null, 204);
    });
}
