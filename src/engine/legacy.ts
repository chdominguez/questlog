import { Rating } from "ts-fsrs";
import { schedule } from "./srs";

/** entrevista-quest stored one course under this key, with bare ids. */
export const LEGACY_KEY = "entrevista-quest-v2";
const LEGACY_COURSE = "entrevista";

/** Old progress → new shape: ids qualified, review deck due now, other cleared challenges scheduled as known. */
export function migrateLegacy(raw: unknown, now: number, course = LEGACY_COURSE): Record<string, unknown> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const q = (id: string) => `${course}:${id}`;
  const review = ids(r.review), cleared = ids(r.cleared);
  const cards = Object.fromEntries([
    ...cleared.filter((id) => !review.includes(id)).map((id) => [q(id), schedule(undefined, Rating.Good, now)]),
    ...review.map((id) => [q(id), schedule(undefined, Rating.Again, now)]),
  ]);
  const levels = r.levels && typeof r.levels === "object"
    ? Object.fromEntries(Object.entries(r.levels).map(([id, l]) => [q(id), l]))
    : {};
  return { ...r, levels, cleared: cleared.map(q), cards, review: undefined, updatedAt: now };
}

/** Copies kata drafts and solved flags (eq2.kata.*.<id>) to the new keys. */
export function migrateKataKeys(storage: Storage, course = LEGACY_COURSE) {
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    const m = k?.match(/^eq2\.kata\.(draft|solved)\.(.+)$/);
    if (m && storage.getItem(`ql.kata.${m[1]}.${course}:${m[2]}`) === null) storage.setItem(`ql.kata.${m[1]}.${course}:${m[2]}`, storage.getItem(k!)!);
  }
}
