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
