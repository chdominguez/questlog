import { Hono, type Context } from "hono";
import { courseOf, type Course } from "../src/course/registry";
import { MAX_ANSWER, qualified, str, type App, type Deps } from "./api";
import { err } from "./errors";

/** The written challenge with this qualified id and its course, or the status to answer with. */
function written(courses: Course[], id: string) {
  const course = courses.find((c) => c.id === courseOf(id));
  const ch = course?.levels.flatMap((l) => l.challenges).find((x) => x.id === id);
  if (!course || !ch) return 404;
  return ch.type === "written" ? { course, ch } : 400;
}

// Stub until WP6 (meter) for /answers/:id/improve and /mock.
const todo = (c: Context) => err(c, 501, "not_configured");

/** POST /grade, /answers/:id/improve, /mock. */
export function gradingRoutes({ courses, grader }: Deps): Hono<App> {
  return new Hono<App>()
    .post("/grade", async (c) => {
      const grade = grader(c.env);
      if (!grade) return err(c, 503, "not_configured", { feature: "grader" }, "Grader not configured (missing ANTHROPIC_API_KEY)");
      const b = ((await c.req.json().catch(() => undefined)) ?? {}) as Record<string, unknown>;
      if (!qualified(b.challengeId)) return err(c, 400, "invalid_request", {}, "Invalid challengeId");
      if (!str(b.answer, MAX_ANSWER, 1)) return err(c, 400, "invalid_request", {}, `Answer must be 1 to ${MAX_ANSWER} characters`);
      const found = written(courses, b.challengeId);
      if (found === 404) return err(c, 404, "not_found", {}, "Unknown challenge");
      if (found === 400) return err(c, 400, "invalid_request", {}, "Not a written challenge");
      const { course, ch } = found;
      try {
        return c.json(await grade({
          prompt: ch.prompt, model: ch.model, keyPoints: ch.keyPoints, answer: b.answer, lang: course.lang, persona: course.grader?.persona,
        }));
      } catch (e) {
        console.error("grade failed:", e);
        return err(c, 502, "ai_failed", { refunded: false }, "Grader failed");
      }
    })
    .post("/answers/:id/improve", todo)
    .post("/mock", todo);
}
