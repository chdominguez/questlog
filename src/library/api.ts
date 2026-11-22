import { useEffect, useSyncExternalStore } from "react";
import type { CourseStatus, FlagInput, ReviewQueue, UserCourseMeta } from "../../shared/api-types";
import { call } from "../api";
import { isDemo } from "../platform";

const post = <T>(path: string, body?: unknown) =>
  call<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });

// Meta of the user's own and opened courses (GET /courses), loaded once on demand for Share and the status pill.
const metas = new Map<string, UserCourseMeta>();
const listeners = new Set<() => void>();
let version = 0;
let loading: Promise<void> | null = null;
const changed = () => { version++; listeners.forEach((f) => f()); };
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

/** User course ids are `u<10 base36>-<slug>`; bundled courses never have a meta. */
export const isUserCourse = (id: string) => /^u[0-9a-z]{10}-/.test(id);

export function setMeta(m: UserCourseMeta) { metas.set(m.id, m); changed(); }

function loadMetas() {
  loading ??= call<UserCourseMeta[]>("/courses").then((list) => { list.forEach((m) => metas.set(m.id, m)); changed(); }, () => { loading = null; });
  return loading;
}

/** The course meta, or undefined for bundled courses, the demo, and until loaded. */
export function useMeta(id: string): UserCourseMeta | undefined {
  const user = isUserCourse(id) && !isDemo;
  useEffect(() => { if (user && !metas.has(id)) void loadMetas(); }, [id, user]);
  useSyncExternalStore(subscribe, () => version);
  return user ? metas.get(id) : undefined;
}

const move = (id: string, action: "share" | "publish" | "unpublish") =>
  post<UserCourseMeta>(`/courses/${encodeURIComponent(id)}/${action}`).then((m) => { setMeta(m); return m; });
export const share = (id: string) => move(id, "share");
export const publish = (id: string) => move(id, "publish");
export const unpublish = (id: string) => move(id, "unpublish");

/** Re-upload: PUT /courses/:id; 422 carries `problems`. */
export const uploadVersion = (id: string, course: unknown) =>
  call<UserCourseMeta>(`/courses/${encodeURIComponent(id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(course) })
    .then((m) => { setMeta(m); return m; });

export const listLibrary = () => call<UserCourseMeta[]>("/library");
export const sendFlag = (f: FlagInput) => post<void>("/flags", f);
export const getReview = () => call<ReviewQueue>("/admin/review");
export const approve = (id: string) => post<void>(`/admin/courses/${encodeURIComponent(id)}/approve`);
export const reject = (id: string, note: string) => post<void>(`/admin/courses/${encodeURIComponent(id)}/reject`, { note });
export const resolveFlag = (id: string) => post<void>(`/admin/flags/${encodeURIComponent(id)}/resolve`);

export const STATUS_LABEL: Record<CourseStatus, string> = {
  private: "Private", link: "Link", pending: "In review", public: "In library", rejected: "Rejected",
};
export const STATUS_PILL: Record<CourseStatus, string> = {
  private: "pill", link: "pill", pending: "pill pill-mid", public: "pill pill-ok", rejected: "pill pill-bad",
};

export type ShareAction = "submit" | "submitAgain" | "makePrivate";
/** Share dialog actions per status (UX 5.7); Copy link is always there. */
export const SHARE_ACTIONS: Record<CourseStatus, ShareAction[]> = {
  private: ["submit"],
  link: ["submit", "makePrivate"],
  pending: ["makePrivate"],
  public: [],
  rejected: ["submitAgain", "makePrivate"],
};

export interface LibraryItem { id: string; title: string; summary: string; levels: number; author: string; cited: boolean; community: boolean }
export type LibraryFilter = "all" | "questie" | "community";

/** Client search on title, summary and author, plus the source filter. */
export function filterLibrary(items: LibraryItem[], query: string, filter: LibraryFilter): LibraryItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((i) => (filter === "all" || i.community === (filter === "community"))
    && words.every((w) => [i.title, i.summary, i.author].some((t) => t.toLowerCase().includes(w))));
}
