import type { Result } from "./store";

/** Exact set is ok; no wrong picks and at least half the right ones is partial. */
export function gradeMulti(answers: number[], picked: number[]): Result {
  const hits = picked.filter((p) => answers.includes(p)).length;
  if (hits === answers.length && picked.length === answers.length) return "ok";
  return hits === picked.length && hits * 2 >= answers.length ? "partial" : "wrong";
}
