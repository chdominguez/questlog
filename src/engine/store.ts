import { useSyncExternalStore } from "react";
import type { ChallengeType } from "../course/schema";
import { setMuted, setVolume } from "../audio/sfx";
import { gradeOf, isCard, schedule, type SrsCard } from "./srs";
import { Rating } from "ts-fsrs";

export const STORAGE_KEY = "questlog-v1";
export const MAX_LIVES = 3;

export const RANKS = [
  { name: "Novice", xp: 0 },
  { name: "Apprentice", xp: 150 },
  { name: "Adept", xp: 400 },
  { name: "Expert", xp: 800 },
  { name: "Master", xp: 1300 },
  { name: "Sage", xp: 1900 },
] as const;

export const BASE_XP: Record<ChallengeType, number> = { quiz: 10, order: 15, bug: 15, written: 25, kata: 40 };
/** Base XP for a challenge already cleared once, so replays can't farm ranks. */
export const REPLAY_XP = 2;

export interface LevelProgress { stars: number; done: boolean }
export interface Run { levelId: string; lives: number; startXp: number }

/** Ids are qualified "<course>:<id>" (src/course/registry.ts). */
export interface Progress {
  xp: number;
  levels: Record<string, LevelProgress>;
  streak: number;
  cards: Record<string, SrsCard>; // spaced-repetition state per challenge seen
  cleared: string[]; // challenge ids answered "ok" at least once
  unlockAll: boolean;
  sound: { muted: boolean; volume: number };
  run: Run | null; // current level attempt, not persisted
  updatedAt: number; // last local change, for sync (newest wins)
}

/** ok: correct · partial: half XP · miss: due for review now · wrong: due for review now and costs a life in a run */
export type Result = "ok" | "partial" | "miss" | "wrong";

export type Action =
  | { type: "start"; levelId: string }
  | { type: "answer"; id: string; ctype: ChallengeType; result: Result; now: number }
  | { type: "finish" } // run completed with lives left
  | { type: "quit" } // run ended without completion
  | { type: "markReview"; id: string; now: number }
  | { type: "unlockAll"; on: boolean }
  | { type: "sound"; muted?: boolean; volume?: number };

export const initial: Progress = {
  xp: 0, levels: {}, streak: 0, cards: {}, cleared: [], unlockAll: false, sound: { muted: false, volume: 0.7 }, run: null, updatedAt: 0,
};

export const multiplier = (streak: number) => (streak >= 5 ? 2 : streak >= 3 ? 1.5 : 1);

export const rankIndex = (xp: number) => {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  return i;
};

/** Progress inside the current rank, 0-1 (1 at the top rank). */
export const rankProgress = (xp: number) => {
  const i = rankIndex(xp);
  const next = RANKS[i + 1];
  return next ? (xp - RANKS[i].xp) / (next.xp - RANKS[i].xp) : 1;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const withId = (list: string[], id: string) => (list.includes(id) ? list : [...list, id]);

export function reducer(s: Progress, a: Action): Progress {
  switch (a.type) {
    case "start":
      return { ...s, run: { levelId: a.levelId, lives: MAX_LIVES, startXp: s.xp } };
    case "answer": {
      const base = s.cleared.includes(a.id) ? REPLAY_XP : BASE_XP[a.ctype];
      const cards = { ...s.cards, [a.id]: schedule(s.cards[a.id], gradeOf(a.result), a.now) };
      if (a.result === "ok") {
        const streak = s.streak + 1;
        return { ...s, streak, cards, xp: s.xp + Math.round(base * multiplier(streak)), cleared: withId(s.cleared, a.id) };
      }
      if (a.result === "partial") return { ...s, streak: 0, cards, xp: s.xp + Math.round(base / 2) };
      const run = a.result === "wrong" && s.run ? { ...s.run, lives: Math.max(0, s.run.lives - 1) } : s.run;
      return { ...s, streak: 0, cards, run };
    }
    case "finish": {
      if (!s.run || s.run.lives <= 0) return { ...s, run: null };
      const prev = s.levels[s.run.levelId];
      const stars = Math.max(prev?.stars ?? 0, s.run.lives);
      return { ...s, run: null, levels: { ...s.levels, [s.run.levelId]: { stars, done: true } } };
    }
    case "quit":
      return { ...s, run: null };
    case "markReview":
      return { ...s, cards: { ...s.cards, [a.id]: schedule(s.cards[a.id], Rating.Again, a.now) } };
    case "unlockAll":
      return { ...s, unlockAll: a.on };
    case "sound":
      return {
        ...s,
        sound: {
          muted: a.muted ?? s.sound.muted,
          volume: a.volume === undefined ? s.sound.volume : clamp(a.volume, 0, 1),
        },
      };
  }
}

/** Accepts anything from storage and returns a valid Progress. */
export function hydrate(raw: unknown): Progress {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Progress>;
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const levels: Record<string, LevelProgress> = {};
  const cards: Record<string, SrsCard> = {};
  if (r.cards && typeof r.cards === "object") for (const [id, c] of Object.entries(r.cards)) if (isCard(c)) cards[id] = c;
  if (r.levels && typeof r.levels === "object") {
    for (const [id, l] of Object.entries(r.levels)) {
      if (l && typeof l === "object") levels[id] = { stars: clamp(num(l.stars, 0), 0, 3), done: l.done === true };
    }
  }
  return {
    xp: Math.max(0, num(r.xp, 0)),
    levels,
    streak: Math.max(0, num(r.streak, 0)),
    cards,
    cleared: strings(r.cleared),
    unlockAll: r.unlockAll === true,
    sound: { muted: r.sound?.muted === true, volume: clamp(num(r.sound?.volume, initial.sound.volume), 0, 1) },
    run: null,
    updatedAt: Math.max(0, num(r.updatedAt, 0)),
  };
}

function load(): Progress {
  try {
    const txt = localStorage.getItem(STORAGE_KEY);
    return txt ? hydrate(JSON.parse(txt)) : initial;
  } catch {
    return initial;
  }
}

let state: Progress = typeof window === "undefined" ? initial : load();
const listeners = new Set<() => void>();
const applySound = () => { setMuted(state.sound.muted); setVolume(state.sound.volume); };
applySound();

const persist = () => {
  try {
    const { run: _run, ...persisted } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch { /* storage unavailable: keep in memory */ }
};

export function dispatch(a: Action): Progress {
  state = { ...reducer(state, a), updatedAt: Date.now() };
  persist();
  if (a.type === "sound") applySound();
  listeners.forEach((l) => l());
  return state;
}

/** Progress as stored and synced (no run). */
export const snapshot = () => { const { run: _run, ...p } = state; return p; };

/** Takes a synced copy when it is newer than ours; keeps the current run. Returns whether it was adopted. */
export function adopt(raw: unknown): boolean {
  const remote = hydrate(raw);
  if (remote.updatedAt <= state.updatedAt) return false;
  state = { ...remote, run: state.run };
  persist();
  applySound();
  listeners.forEach((l) => l());
  return true;
}

export const getProgress = () => state;
export const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
export const useProgress = () => useSyncExternalStore(subscribe, getProgress);
