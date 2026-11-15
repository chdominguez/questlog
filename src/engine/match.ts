import type { Result } from "./store";

/** `link[i]` is the right-item index linked to left item i. ok: all right; partial: at most 2 wrong and under half; else wrong. */
export function gradeMatch(link: number[]): Result {
  const wrong = link.filter((r, i) => r !== i).length;
  return wrong === 0 ? "ok" : wrong <= 2 && wrong * 2 < link.length ? "partial" : "wrong";
}
