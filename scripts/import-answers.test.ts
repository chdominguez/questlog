import { expect, test } from "vitest";
import { sqliteD1 } from "../worker/d1-sqlite";
import { toSql } from "./import-answers";

test("qualifies ids, escapes quotes and is idempotent", async () => {
  const a = { id: "1", challengeId: "age-w-1", levelId: "01-agentes", prompt: "It's 'quoted'", answer: "a'); DROP TABLE answers; --", source: "typed",
    seconds: 12, grade: { score: 7, covered: [], missing: [], mistakes: [], improved: "o'k" }, createdAt: "2026-11-10T10:00:00Z" };
  const b = { ...a, id: "2", challengeId: "other:x", selfScore: 6, grade: undefined, seconds: undefined };
  const { sql, count, skipped } = toSql([JSON.stringify(a), "{bad", JSON.stringify({ id: 3 }), "", JSON.stringify(b)].join("\n"), "entrevista");
  expect([count, skipped]).toEqual([2, 2]);
  const db = sqliteD1();
  for (const s of [...sql.split("\n"), ...sql.split("\n")]) await db.prepare(s).run();
  const { results } = await db.prepare("SELECT * FROM answers ORDER BY id").all();
  expect(results).toEqual([
    { id: "1", course_id: "entrevista", challenge_id: "entrevista:age-w-1", level_id: "entrevista:01-agentes", prompt: a.prompt, answer: a.answer,
      source: "typed", seconds: 12, grade: JSON.stringify(a.grade), self_score: null, created_at: a.createdAt },
    { id: "2", course_id: "other", challenge_id: "other:x", level_id: "entrevista:01-agentes", prompt: a.prompt, answer: a.answer,
      source: "typed", seconds: null, grade: null, self_score: 6, created_at: a.createdAt },
  ]);
});
