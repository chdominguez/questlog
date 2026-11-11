/** Uniform random permutation of 0..n-1 (identity allowed). */
export function permutation(n: number, rand: () => number = Math.random): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Permutation that never returns the identity (for "put in order" puzzles). */
export function shuffled(n: number, rand: () => number = Math.random): number[] {
  const a = permutation(n, rand);
  return n > 1 && a.every((v, i) => v === i) ? [...a.slice(1), a[0]] : a;
}
