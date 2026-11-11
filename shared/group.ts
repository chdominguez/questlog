import type { SavedAnswer } from "./api-types";

/** Claude's grade when there is one, else the self-rating. */
export const scoreOf = (a: SavedAnswer) => a.grade?.score ?? a.selfScore;

export interface ChallengeGroup { challengeId: string; prompt: string; attempts: SavedAnswer[]; best?: number }
export interface LevelGroup { levelId: string; title: string; challenges: ChallengeGroup[] }

/** Groups answers (newest first) by level, then challenge. Levels follow `levels` order; unknown levels go last. */
export function groupAnswers(answers: SavedAnswer[], levels: { id: string; title: string }[], filter = ""): LevelGroup[] {
  const q = filter.trim().toLowerCase();
  const byCh = new Map<string, ChallengeGroup & { levelId: string }>();
  for (const a of answers) {
    let g = byCh.get(a.challengeId);
    if (!g) byCh.set(a.challengeId, (g = { challengeId: a.challengeId, levelId: a.levelId, prompt: a.prompt, attempts: [] }));
    g.attempts.push(a);
    const s = scoreOf(a);
    if (s !== undefined && (g.best === undefined || s > g.best)) g.best = s;
  }
  const order = new Map(levels.map((l, i) => [l.id, i]));
  const out = new Map<string, LevelGroup>();
  for (const g of byCh.values()) {
    if (q && !g.prompt.toLowerCase().includes(q) && !g.attempts.some((a) => a.answer.toLowerCase().includes(q))) continue;
    const { levelId, ...ch } = g;
    if (!out.has(levelId)) out.set(levelId, { levelId, title: levels.find((l) => l.id === levelId)?.title ?? levelId, challenges: [] });
    out.get(levelId)!.challenges.push(ch);
  }
  const rank = (id: string) => order.get(id) ?? Infinity;
  return [...out.values()].sort((a, b) => rank(a.levelId) - rank(b.levelId));
}
