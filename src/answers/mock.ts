import type { Challenge, Level } from "../course/schema";

export type Written = Extract<Challenge, { type: "written" }>;
export type MockQuestion = { challenge: Written; levelId: string };

/** Written challenges of the boss level; otherwise up to `n` random written challenges from all levels. */
export function pickMockQuestions(levels: Level[], n = 8, rnd = Math.random): MockQuestion[] {
  const written = (l: Level) =>
    l.challenges.filter((c): c is Written => c.type === "written").map((challenge) => ({ challenge, levelId: l.id }));
  const boss = levels.find((l) => l.boss);
  const fromBoss = boss ? written(boss) : [];
  if (fromBoss.length) return fromBoss;
  const pool = levels.flatMap(written);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

/** A running mock in sessionStorage (ql.mock.<course>), so a reload resumes it without a new charge. */
export type MockSession = { mockId?: string; endAt: number; i: number; ids: string[]; scores: (number | null)[] };
const storeKey = (course: string) => `ql.mock.${course}`;

/** The stored session with its questions, unless it ended or its questions are gone. */
export function resumable(course: string, levels: Level[], now = Date.now()): (MockSession & { questions: MockQuestion[] }) | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(storeKey(course)) ?? "null") as MockSession | null;
    if (!s || !(s.endAt > now) || !Array.isArray(s.ids)) return null;
    const all = levels.flatMap((l) => l.challenges.map((challenge) => ({ challenge, levelId: l.id })));
    const questions = s.ids.map((id) => all.find((q) => q.challenge.id === id)).filter((q): q is MockQuestion => q?.challenge.type === "written");
    return questions.length && questions.length === s.ids.length ? { ...s, questions } : null;
  } catch { return null; }
}

export function storeMock(course: string, s: MockSession | null) {
  try { if (s) sessionStorage.setItem(storeKey(course), JSON.stringify(s)); else sessionStorage.removeItem(storeKey(course)); } catch { /* storage off */ }
}
