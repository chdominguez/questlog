import type { SavedAnswer } from "../../shared/api-types";

/** Inserts `chunk` at `pos`, adding a space on either side when it would glue to a word. Returns the new text and caret. */
export function insertAt(text: string, pos: number, chunk: string): { text: string; pos: number } {
  const p = Math.max(0, Math.min(pos, text.length));
  const c = chunk.trim();
  if (!c) return { text, pos: p };
  const before = text.slice(0, p), after = text.slice(p);
  const pre = before && !/\s$/.test(before) ? " " : "";
  const post = after && !/^\s/.test(after) ? " " : "";
  const ins = pre + c + post;
  return { text: before + ins + after, pos: p + pre.length + c.length };
}

export const sourceOf = (typed: boolean, dictated: boolean): SavedAnswer["source"] =>
  typed && dictated ? "mixed" : dictated ? "dictated" : "typed";

export const SOURCE_LABEL: Record<SavedAnswer["source"], string> = { typed: "Typed", dictated: "Dictated", mixed: "Mixed" };

export const SELF_RATINGS = [
  { label: "Got it", score: 9 },
  { label: "Partly", score: 6 },
  { label: "Missed it", score: 2 },
] as const;

export const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

export const fmtDate = (iso: string, lang?: string) =>
  new Date(iso).toLocaleString(lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Mean of the numbers, rounded to one decimal; null when empty. */
export const average = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
