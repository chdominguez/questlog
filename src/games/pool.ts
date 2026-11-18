import type { Challenge, ChallengeType, Level } from "../course/schema";
import { isUnlocked } from "../engine/levels";
import { permutation } from "../engine/shuffle";
import type { Progress } from "../engine/store";

interface Src { id: string; ctype: ChallengeType }
export interface QuizItem extends Src { prompt: string; options: string[]; answer: number; tf?: boolean }
export interface Pair extends Src { left: string; right: string }
export interface OrderItem extends Src { prompt: string; steps: string[] }
export interface TypeItem extends Src { prompt: string; answers: string[]; exact?: boolean }
export interface Pool { quiz: QuizItem[]; pairs: Pair[]; orders: OrderItem[]; typing: TypeItem[] }

/** Smallest pool each game can be played with. */
export const MIN = { quiz: 4, match: 3, order: 1, falling: 3 };
export const ROUND_PAIRS = 6;

type Of<T extends ChallengeType> = Extract<Challenge, { type: T }>;
const withCode = (ch: Challenge) => (ch.code ? `${ch.prompt}\n\n\`\`\`${ch.code.lang}\n${ch.code.src}\n\`\`\`` : ch.prompt);
const gapped = (c: Of<"cloze">) => {
  const t = c.text.replace(/\{\{\d+\}\}/, "____");
  return `${c.prompt}\n\n${c.lang ? `\`\`\`${c.lang}\n${t}\n\`\`\`` : t}`;
};
/** Up to n random items, shuffled. */
export const sample = <T,>(xs: T[], n = xs.length, rand: () => number = Math.random) => permutation(xs.length, rand).slice(0, n).map((i) => xs[i]);

/** Game items from the challenges of a course's unlocked levels (map order, as in course.levels). */
export function buildPool(levels: Level[], p: Pick<Progress, "levels" | "unlockAll">, rand: () => number = Math.random): Pool {
  const chs = levels.filter((_, i) => isUnlocked(levels, i, p)).flatMap((l) => l.challenges);
  const cards = chs.filter((c): c is Of<"flashcard"> => c.type === "flashcard");
  const pool: Pool = { quiz: [], pairs: [], orders: [], typing: [] };
  const seen = new Set<string>(); // a left or right shown twice would make a match ambiguous
  const pair = (src: Src, left: string, right: string) => {
    if (seen.has(left) || seen.has(right)) return;
    seen.add(left); seen.add(right);
    pool.pairs.push({ ...src, left, right });
  };
  for (const ch of chs) {
    const src = { id: ch.id, ctype: ch.type };
    if (ch.type === "quiz") pool.quiz.push({ ...src, prompt: withCode(ch), options: ch.options, answer: ch.answer });
    if (ch.type === "multi" && (ch.answers.length === 1 || ch.style === "truefalse"))
      pool.quiz.push({ ...src, prompt: withCode(ch), options: ch.options, answer: ch.answers[0], ...(ch.style && { tf: true }) });
    if (ch.type === "match") ch.pairs.forEach((x) => pair(src, x.left, x.right));
    if (ch.type === "order") pool.orders.push({ ...src, prompt: withCode(ch), steps: ch.steps });
    if (ch.type === "cloze" && ch.blanks.length === 1) {
      const b = ch.blanks[0];
      if (ch.bank) pool.quiz.push({ ...src, prompt: gapped(ch), options: ch.bank, answer: ch.bank.indexOf(b.answers[0]) });
      pool.typing.push({ ...src, prompt: gapped(ch), answers: b.answers, ...(b.exact && { exact: true }) });
    }
    if (ch.type === "flashcard") {
      pair(src, ch.prompt, ch.back);
      // shortcut: strips only backticks from a Markdown back, so "`200`" is typed as 200; other Markdown stays
      const typed = ch.back.replace(/`/g, "").trim();
      if (typed.length <= 30) pool.typing.push({ ...src, prompt: ch.prompt, answers: [typed] });
      const others = [...new Set(cards.map((c) => c.back).filter((b) => b !== ch.back))];
      if (cards.length >= 4 && others.length >= 3) pool.quiz.push({ ...src, prompt: ch.prompt, options: [ch.back, ...sample(others, 3, rand)], answer: 0 });
    }
  }
  return pool;
}
