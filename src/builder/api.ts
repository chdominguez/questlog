import { useSyncExternalStore } from "react";
import type { BuildRequest, Job, JobPoll, Upload, UserCourseMeta } from "../../shared/api-types";
import { ApiError, apiFetch, call } from "../api";
import { markCoursesLoaded, registerCourses, unregisterCourse } from "../course/registry";

const KEY = "ql.courses";
// shortcut: localStorage caps near 5 MB; move to IndexedDB if users keep many large courses
type Cached = { id: string; version: number; json: unknown }[];
const read = (): Cached => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const write = (c: Cached) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* full or off: next start loads from the server */ } };

/** The user's course list from the server (own + opened by link), and how loading went. */
export interface UserCourses { status: "idle" | "loading" | "ok" | "error"; metas: UserCourseMeta[] }
let state: UserCourses = { status: "idle", metas: [] };
const listeners = new Set<() => void>();
const set = (s: Partial<UserCourses>) => { state = { ...state, ...s }; listeners.forEach((f) => f()); };
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useUserCourses = () => useSyncExternalStore(subscribe, () => state);

/**
 * Registers the cached course list (ql.courses) synchronously, before its first await: main.tsx calls it before the
 * first render. Then fetches GET /courses and course JSON for new versions, and marks the registry loaded.
 */
export async function loadCourses(): Promise<void> {
  let cached = read();
  if (cached.length && state.status === "idle") registerCourses(cached.map((c) => c.json));
  set({ status: "loading" });
  try {
    const metas = await call<UserCourseMeta[]>("/courses");
    const next: Cached = await Promise.all(metas.map(async (m) =>
      cached.find((c) => c.id === m.id && c.version === m.version) ?? { id: m.id, version: m.version, json: await call<unknown>(`/courses/${m.id}`) }));
    cached = read(); // courses fetched by link meanwhile stay
    for (const c of cached) if (!next.some((n) => n.id === c.id)) unregisterCourse(c.id);
    registerCourses(next.map((c) => c.json));
    write(next);
    set({ status: "ok", metas });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) { for (const c of cached) unregisterCourse(c.id); write([]); } // signed out: drop the last account's courses
    set({ status: "error" });
  } finally {
    markCoursesLoaded();
  }
}

/** A course not in the registry (opened by link): fetch and register it. False when the server has none. */
export async function fetchCourse(id: string): Promise<boolean> {
  const res = await apiFetch(`/courses/${encodeURIComponent(id)}`);
  if (!res.ok) return false;
  const json = await res.json();
  const version = Number(/"v(\d+)"/.exec(res.headers.get("ETag") ?? "")?.[1] ?? 0);
  registerCourses([json]);
  write([...read().filter((c) => c.id !== id), { id, version, json }]);
  return true;
}

export const startBuild = (req: BuildRequest, key: string) =>
  call<{ jobId: string }>("/builder/jobs", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(req) });

export function uploadSource(file: File): Promise<Upload> {
  const body = new FormData();
  body.append("file", file);
  return call<Upload>("/builder/uploads", { method: "POST", body });
}

export const getJob = (id: string, after = 0) => call<JobPoll>(`/jobs/${encodeURIComponent(id)}?after=${after}`);
export const listJobs = () => call<Job[]>("/jobs?kind=build");

/** The last request sent per job, so a failed build can be retried or edited. */
export interface Draft { req: BuildRequest; files?: Upload[] }
const DRAFT = "ql.build";
export const saveDraft = (jobId: string | null, d: Draft) => { try { sessionStorage.setItem(DRAFT, JSON.stringify({ jobId, ...d })); } catch { /* off */ } };
export function loadDraft(jobId?: string | null): Draft | null {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT) ?? "null") as (Draft & { jobId: string | null }) | null;
    return d && (jobId === undefined || d.jobId === jobId) ? d : null;
  } catch { return null; }
}

/** Failed builds already opened, so Home stops showing their card. */
const SEEN = "ql.seenJobs";
export const seenJobs = (): string[] => { try { return JSON.parse(localStorage.getItem(SEEN) ?? "[]"); } catch { return []; } };
export const markJobSeen = (id: string) => { try { localStorage.setItem(SEEN, JSON.stringify([id, ...seenJobs().filter((x) => x !== id)].slice(0, 20))); } catch { /* off */ } };
