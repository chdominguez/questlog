import { Hono, type Context } from "hono";
import type { Grade, MockStart } from "../shared/api-types";
import { courseOf, type Course } from "../src/course/registry";
import { MAX_ANSWER, qualified, str, type App, type Deps } from "./api";
import { findCourse } from "./courses";
import type { Db } from "./db";
import { balance, charge, metered, refund } from "./credits";
import { err } from "./errors";
import { parseGrade, parseImprovement, type GradeInput } from "./grader";

const MOCK_GRACE_MS = 10 * 60_000;

/** Deps courses (static, or test fixtures) first, then user courses under the access rule. */
export const courseFor = async ({ courses }: Deps, db: Db, user: string, id: string): Promise<Course | null> =>
  courses.find((x) => x.id === id) ?? (await findCourse(db, id, user));

const writtenIn = (course: Course | null, id: string) => {
  const ch = course?.levels.flatMap((l) => l.challenges).find((x) => x.id === id);
  return ch?.type === "written" ? ch : ch ? 400 : 404;
};

/** The written challenge with this qualified id as grader input, or the status to answer with. */
async function written(deps: Deps, c: Context<App>, id: string, answer: string): Promise<GradeInput | 400 | 404> {
  const course = await courseFor(deps, c.env.DB, c.get("user"), courseOf(id));
  const ch = writtenIn(course, id);
  if (typeof ch === "number") return ch;
  return { prompt: ch.prompt, model: ch.model, keyPoints: ch.keyPoints, answer, lang: course!.lang, persona: course!.grader?.persona };
}

/** Questions a mock serves: the boss level's written challenges, else up to 8 from all levels (src/answers/mock.ts). */
export function mockQuestions(course: Course): number {
  const w = (l: Course["levels"][number]) => l.challenges.filter((x) => x.type === "written").length;
  const boss = course.levels.find((l) => l.boss);
  return (boss && w(boss)) || Math.min(8, course.levels.reduce((n, l) => n + w(l), 0));
}

type MockRow = { user_id: string; course_id: string; spend_id: string | null; grades_left: number; expires_at: string };

/** POST /grade, /answers/:id/improve, /mock. */
export function gradingRoutes(deps: Deps): Hono<App> {
  const body = async (c: Context<App>) => ((await c.req.json().catch(() => undefined)) ?? {}) as Record<string, unknown>;
  const notConfigured = (c: Context<App>) => err(c, 503, "not_configured", { feature: "grader" }, "Grader not configured (missing ANTHROPIC_API_KEY)");

  return new Hono<App>()
    .post("/grade", async (c) => {
      const grade = deps.grader(c.env);
      if (!grade) return notConfigured(c);
      const b = await body(c);
      if (!qualified(b.challengeId)) return err(c, 400, "invalid_request", {}, "Invalid challengeId");
      if (!str(b.answer, MAX_ANSWER, 1)) return err(c, 400, "invalid_request", {}, `Answer must be 1 to ${MAX_ANSWER} characters`);
      if (b.mockId !== undefined && !str(b.mockId, 100, 1)) return err(c, 400, "invalid_request", {}, "Invalid mockId");
      const input = await written(deps, c, b.challengeId, b.answer);
      if (input === 404) return err(c, 404, "not_found", {}, "Unknown challenge");
      if (input === 400) return err(c, 400, "invalid_request", {}, "Not a written challenge");
      const run = async () => c.json(await grade(input));
      if (b.mockId === undefined) return charge(c, "grade", b.challengeId, run);

      const now = deps.now().toISOString();
      const db = c.env.DB, user = c.get("user");
      const mock = db.tx((q) => {
        const m = q.get<MockRow>("SELECT user_id, course_id, spend_id, grades_left, expires_at FROM mock_sessions WHERE id = ?", b.mockId);
        if (!m || m.user_id !== user || m.course_id !== courseOf(b.challengeId as string)) return 404;
        if (m.expires_at <= now) return 410;
        if (m.grades_left <= 0) return 409;
        q.run("UPDATE mock_sessions SET grades_left = grades_left - 1 WHERE id = ?", b.mockId);
        return m;
      });
      if (mock === 404) return err(c, 404, "not_found", {}, "Unknown mock exam");
      if (mock === 410) return err(c, 410, "mock_expired", {}, "Mock exam expired");
      if (mock === 409) return err(c, 409, "mock_exhausted", {}, "No grades left in this mock exam");
      try { return await run(); } catch (e) {
        console.error("mock grade failed:", e);
        // The exam's first grade failed: refund the mock and close the session. Later failures retry free inside it.
        const course = await courseFor(deps, db, user, mock.course_id);
        const first = !!course && !!mock.spend_id && mock.grades_left === 2 * mockQuestions(course);
        const closed = first && db.tx((q) => q.run("UPDATE mock_sessions SET grades_left = 0, spend_id = NULL WHERE id = ? AND spend_id = ?", b.mockId, mock.spend_id)) === 1;
        const refunded = closed && refund(db, mock.spend_id!, "ai_failed");
        if (metered(c.env)) c.header("x-credits-balance", String(balance(db, user).total));
        return err(c, 502, "ai_failed", { refunded }, "Grader failed");
      }
    })
    .post("/answers/:id/improve", async (c) => {
      const improve = deps.improver(c.env);
      if (!improve) return notConfigured(c);
      const id = c.req.param("id");
      const row = await c.env.DB.prepare("SELECT challenge_id, answer, grade FROM answers WHERE id = ? AND user_id = ?")
        .bind(id, c.get("user")).first<{ challenge_id: string; answer: string; grade: string | null }>();
      if (!row) return err(c, 404, "not_found", {}, "Answer not found");
      const grade = row.grade ? parseGrade(JSON.parse(row.grade)) : null;
      if (!grade) return err(c, 409, "invalid_request", {}, "Answer has no grade");
      if (grade.improved) return err(c, 409, "invalid_request", {}, "Answer already has a stronger answer");
      const input = await written(deps, c, row.challenge_id, row.answer);
      if (input === 404) return err(c, 404, "not_found", {}, "Unknown challenge");
      if (input === 400) return err(c, 400, "invalid_request", {}, "Not a written challenge");
      return charge(c, "improve", id, async () => {
        const out = parseImprovement(await improve({ ...input, grade }));
        if (!out) throw new Error("Invalid improver output");
        const saved: Grade = { ...grade, ...out };
        await c.env.DB.prepare("UPDATE answers SET grade = ? WHERE id = ? AND user_id = ?").bind(JSON.stringify(saved), id, c.get("user")).run();
        return c.json(out);
      });
    })
    .post("/mock", async (c) => {
      if (!deps.grader(c.env)) return notConfigured(c);
      const b = await body(c);
      if (!str(b.courseId, 100, 1)) return err(c, 400, "invalid_request", {}, "Invalid courseId");
      const course = await courseFor(deps, c.env.DB, c.get("user"), b.courseId);
      if (!course) return err(c, 404, "not_found", {}, "Unknown course");
      const n = mockQuestions(course);
      if (!course.mock || !n) return err(c, 400, "invalid_request", {}, "Course has no mock exam");
      const { seconds } = course.mock;
      return charge(c, "mock", course.id, async (spendId) => {
        const now = deps.now();
        const start: MockStart = { mockId: crypto.randomUUID(), expiresAt: new Date(now.getTime() + seconds * 1000 + MOCK_GRACE_MS).toISOString() };
        await c.env.DB.prepare("INSERT INTO mock_sessions (id, user_id, course_id, spend_id, grades_left, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(start.mockId, c.get("user"), course.id, spendId, 2 * n, start.expiresAt, now.toISOString()).run();
        return c.json(start);
      });
    });
}
