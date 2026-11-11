/** Helpers for typed course files: `import { defineCourse, at, hl } from "questlog/authoring"`. */
import type { CourseInput } from "./schema";
export type * from "./schema";

/** Identity helper that type-checks a course file: `export default defineCourse({...})`. */
export const defineCourse = (c: CourseInput) => c;

/** 1-based numbers of the lines in `src` that contain any of `needles`.
 * Throws when a needle matches nothing, so editing a snippet can't silently drop a highlight. */
export function hl(src: string, ...needles: string[]): number[] {
  const lines = src.split("\n");
  const out = new Set<number>();
  for (const n of needles) {
    const hits = lines.flatMap((l, i) => (l.includes(n) ? [i + 1] : []));
    if (!hits.length) throw new Error(`hl: "${n}" not found`);
    hits.forEach((h) => out.add(h));
  }
  return [...out].sort((a, b) => a - b);
}

/** The single 1-based line of `src` containing `needle`. Throws when it matches none or several. */
export function at(src: string, needle: string): number {
  const hits = src.split("\n").flatMap((l, i) => (l.includes(needle) ? [i + 1] : []));
  if (hits.length !== 1) throw new Error(`at: "${needle}" matches ${hits.length} lines`);
  return hits[0];
}
