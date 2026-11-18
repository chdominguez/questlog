import { multiplier } from "../engine/store";

/** Kahoot points for an answer after `ms` of a `limit` ms question: 1000 under 0.5s, down to 500 at the buzzer, times the streak multiplier. */
export function points(correct: boolean, ms: number, limit: number, streak: number): number {
  if (!correct || ms >= limit) return 0;
  const base = ms < 500 ? 1000 : Math.round(1000 * (1 - ms / limit / 2));
  return Math.round(base * multiplier(streak));
}
