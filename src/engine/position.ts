import type { Result } from "./store";
import { MAX_LIVES } from "./store";

/** Where a level attempt stands, so a reload resumes it. Per device; not synced. */
export interface Pos { phase: "theory" | "play"; card: number; i: number; lives: number; res: (Result | null)[] }

export const POS_PREFIX = "ql.pos.";
const RESULTS: (Result | null)[] = ["ok", "partial", "miss", "wrong", null];
const int = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;

/** The saved position for a level with `total` challenges and `cards` theory cards, or null when none or stale. */
export function loadPos(level: string, total: number, cards: number): Pos | null {
  try {
    const p = JSON.parse(localStorage.getItem(POS_PREFIX + level) ?? "null") as Partial<Pos> | null;
    if (!p || (p.phase !== "theory" && p.phase !== "play")) return null;
    if (!Array.isArray(p.res) || p.res.length !== total || !p.res.every((r) => RESULTS.includes(r))) return null;
    if (!int(p.i, 0, Math.max(0, total - 1)) || !int(p.card, 0, Math.max(0, cards - 1)) || !int(p.lives, 1, MAX_LIVES)) return null;
    return p as Pos;
  } catch { return null; }
}

export function savePos(level: string, p: Pos) {
  try { localStorage.setItem(POS_PREFIX + level, JSON.stringify(p)); } catch { /* storage off */ }
}

export function clearPos(level: string) {
  try { localStorage.removeItem(POS_PREFIX + level); } catch { /* storage off */ }
}

/** Next unanswered challenge after `i` (which counts as answered), wrapping round; -1 when none is left. */
export function nextOpen(res: (Result | null)[], i: number): number {
  for (let k = 1; k < res.length; k++) {
    const j = (i + k) % res.length;
    if (res[j] === null) return j;
  }
  return -1;
}
