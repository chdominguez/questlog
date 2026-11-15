import type { Result } from "./store";

/** `placed[i]` is the bucket chosen for item i. All right ok, at least half partial, else wrong. */
export function gradeSort(items: { bucket: number }[], placed: number[]): Result {
  const right = items.filter((it, i) => placed[i] === it.bucket).length;
  return right === items.length ? "ok" : right * 2 >= items.length ? "partial" : "wrong";
}
