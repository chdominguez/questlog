import type { Challenge } from "../course/schema";
import type { Result } from "./store";

type Blank = Extract<Challenge, { type: "cloze" }>["blanks"][number];

/** Splits text into strings and 0-based blank indexes: "a {{1}}" -> ["a ", 0]. */
export function clozeParts(text: string): (string | number)[] {
  return text.split(/\{\{(\d+)\}\}/).map((p, i) => (i % 2 ? Number(p) - 1 : p)).filter((p) => p !== "");
}

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export function gradeCloze(blanks: Blank[], vals: string[]): { right: boolean[]; result: Result } {
  const right = blanks.map((b, i) => b.answers.some((a) => (b.exact ? a === vals[i] : norm(a) === norm(vals[i] ?? ""))));
  const n = right.filter(Boolean).length;
  return { right, result: n === blanks.length ? "ok" : n * 2 >= blanks.length ? "partial" : "wrong" };
}
