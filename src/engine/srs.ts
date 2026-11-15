import { createEmptyCard, fsrs, Rating, type Card, type Grade } from "ts-fsrs";
import type { Result } from "./store";
import { courseOf } from "../course/registry";

// No learning steps: a right answer goes days out; a miss is due right away (handled below), like the old review deck.
const f = fsrs({ enable_fuzz: false, learning_steps: [], relearning_steps: [] });

/** ts-fsrs card with dates as epoch ms, so it survives JSON. */
export type SrsCard = Omit<Card, "due" | "last_review"> & { due: number; last_review?: number };

export const gradeOf = (r: Result, easy?: boolean): Grade => (r === "ok" ? (easy ? Rating.Easy : Rating.Good) : r === "partial" ? Rating.Hard : Rating.Again);

export function schedule(card: SrsCard | undefined, grade: Grade, now: number): SrsCard {
  const c: Card = card
    ? { ...card, due: new Date(card.due), last_review: card.last_review === undefined ? undefined : new Date(card.last_review) }
    : createEmptyCard(new Date(now));
  const next = f.next(c, new Date(now), grade).card;
  return {
    ...next,
    due: grade === Rating.Again ? now : next.due.getTime(),
    last_review: next.last_review?.getTime(),
  };
}

/** Keys of cards due at `now`, most overdue first. */
export const dueKeys = (cards: Record<string, SrsCard>, now: number) =>
  Object.entries(cards).filter(([, c]) => c.due <= now).sort((a, b) => a[1].due - b[1].due).map(([k]) => k);

/** Due keys of one course, none once it is completed. */
export const courseDue = (p: { cards: Record<string, SrsCard>; completed: string[] }, course: string, now: number) =>
  p.completed.includes(course) ? [] : dueKeys(p.cards, now).filter((id) => courseOf(id) === course);

export const isCard = (v: unknown): v is SrsCard => {
  const c = v as SrsCard;
  return !!c && typeof c === "object" && [c.due, c.stability, c.difficulty, c.reps, c.lapses, c.state].every((n) => typeof n === "number" && Number.isFinite(n));
};
