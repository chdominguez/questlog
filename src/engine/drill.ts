/** Rounds of an incremental match drill over n pairs: one new pair per round alongside the previous two, then all of them. */
export function ladder(n: number): number[][] {
  const rounds = Array.from({ length: n }, (_, k) => Array.from({ length: Math.min(k + 1, 3) }, (_, j) => k - Math.min(k, 2) + j));
  return n > 3 ? [...rounds, Array.from({ length: n }, (_, i) => i)] : rounds;
}
