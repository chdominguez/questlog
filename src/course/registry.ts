/**
 * Loads every course under /courses/<id>/course.{ts,json} and the private courses folder (alias @private,
 * env QUESTIE_COURSES, or QUESTLOG_COURSES). Ids are qualified as "<course>:<id>" so progress, answers and art never collide.
 */
import { useSyncExternalStore } from "react";
import { addArt } from "../art";
import { mdMedia, mediaUrl } from "../../shared/media";
import { API_BASE } from "../platform";
import { mapOrder } from "../engine/levels";
import { CourseSchema, formatIssues, type Challenge, type CourseInput, type Kata, type Level } from "./schema";

export interface Course extends Omit<CourseInput, "katas" | "levels"> {
  levels: Level[]; // map order, boss last; ids qualified
  katas: Record<string, Kata>; // by qualified id
}

export const q = (course: string, id: string) => `${course}:${id}`;
export const courseOf = (key: string) => key.slice(0, key.indexOf(":"));
export const local = (key: string) => key.slice(key.indexOf(":") + 1);

/** `base` prefixes media URLs: the server origin on native, "" on web. */
export function resolve(c: CourseInput, base = ""): Course {
  const Q = (id: string) => q(c.id, id);
  const art = (k: string) => (c.art?.[k] ? Q(k) : k);
  const md = (t: string) => mdMedia(c.id, t, base); // shortcut: only prompt/explain and md blocks; images in options, steps or notes stay unrewritten
  const block = (b: Level["theory"][number]["blocks"][number]) =>
    b.kind === "figure" ? { ...b, art: art(b.art) }
    : b.kind === "md" ? { ...b, text: md(b.text) }
    : b.kind === "media" ? { ...b, src: mediaUrl(c.id, b.src, base), ...(b.poster && { poster: mediaUrl(c.id, b.poster, base) }) }
    : b;
  const levels = mapOrder(c.levels.map((l) => ({
      ...l,
      id: Q(l.id),
      ...(l.art && { art: art(l.art) }),
      theory: l.theory.map((t) => ({ ...t, blocks: t.blocks.map(block) })),
      challenges: l.challenges.map((ch) => ({ ...ch, id: Q(ch.id), prompt: md(ch.prompt), ...(ch.explain && { explain: md(ch.explain) }), ...(ch.type === "kata" && { kataId: Q(ch.kataId) }) }) as Challenge),
    })));
  return { ...c, levels, katas: Object.fromEntries((c.katas ?? []).map((k) => [Q(k.id), { ...k, id: Q(k.id) }])) };
}

/** Validates raw module exports; invalid courses are reported and skipped so one bad file can't take the app down. */
export function load(mods: Record<string, { default: unknown }>): { courses: Course[]; errors: { file: string; error: string }[] } {
  const courses: Course[] = [];
  const errors: { file: string; error: string }[] = [];
  for (const [file, m] of Object.entries(mods)) {
    const r = CourseSchema.safeParse(m.default);
    if (!r.success) { errors.push({ file, error: formatIssues(r.error) }); continue; }
    if (courses.some((c) => c.id === r.data.id)) { errors.push({ file, error: `duplicate course id "${r.data.id}"` }); continue; }
    courses.push(resolve(r.data, API_BASE));
  }
  return { courses: courses.sort((a, b) => a.title.localeCompare(b.title)), errors };
}

const mods = import.meta.glob<{ default: unknown }>(["/courses/*/course.ts", "/courses/*/course.json", "@private/*/course.ts", "@private/*/course.json"], { eager: true });
const loaded = load(mods);
for (const e of loaded.errors) console.error(`Course ${e.file} skipped:\n${e.error}`);
const qualifyArt = (c: Course) => { if (c.art) addArt(Object.fromEntries(Object.entries(c.art).map(([k, v]) => [q(c.id, k), v]))); };
loaded.courses.forEach(qualifyArt);

/** Bundled courses plus runtime ones from the server (registerCourses); mutated in place so sync callers keep working. */
export const COURSES = loaded.courses;
const BUNDLED = new Set(COURSES.map((c) => c.id));
export const COURSE_ERRORS = loaded.errors;
// shortcut: hides, doesn't secure; course data ships in the bundle, move it server-side if a course must stay secret
export const visibleTo = (user: string, courses: Course[] = COURSES) =>
  courses.filter((c) => !c.users || c.users.some((u) => u.toLowerCase() === user.toLowerCase()));
export const courseById = (id: string) => COURSES.find((c) => c.id === id);
export const levelByKey = (key: string) => courseById(courseOf(key))?.levels.find((l) => l.id === key);
export const kataByKey = (key: string) => courseById(courseOf(key))?.katas[key];

/** Every challenge by qualified id, with its level. */
export const CHALLENGES: Record<string, Challenge & { levelId: string }> = Object.fromEntries(
  COURSES.flatMap((c) => c.levels.flatMap((l) => l.challenges.map((ch) => [ch.id, { ...ch, levelId: l.id }]))),
);

const challengesOf = (c: Course) => c.levels.flatMap((l) => l.challenges.map((ch) => [ch.id, { ...ch, levelId: l.id }] as const));

const listeners = new Set<() => void>();
let version = 0;
let loadedOnce = false;
const changed = () => { version++; listeners.forEach((f) => f()); };

/** Adds or replaces runtime courses (user-built, link, public). Invalid ones are skipped; bundled ids win. */
export function registerCourses(raw: unknown[]) {
  for (const input of raw) {
    const r = CourseSchema.safeParse(input);
    if (!r.success || BUNDLED.has(r.data.id)) continue;
    const c = resolve(r.data, API_BASE);
    const i = COURSES.findIndex((x) => x.id === c.id);
    if (i >= 0) { dropChallenges(COURSES[i]); COURSES.splice(i, 1, c); } else COURSES.push(c);
    qualifyArt(c);
    for (const [id, ch] of challengesOf(c)) CHALLENGES[id] = ch;
  }
  changed();
}

const dropChallenges = (c: Course) => { for (const [id] of challengesOf(c)) delete CHALLENGES[id]; };

/** Removes a runtime course; bundled courses stay. */
export function unregisterCourse(id: string) {
  const i = COURSES.findIndex((c) => c.id === id);
  if (i < 0 || BUNDLED.has(id)) return;
  dropChallenges(COURSES[i]);
  COURSES.splice(i, 1);
  changed();
}

/** False until the first course load from the server has settled (or was skipped, as in the demo). */
export const coursesLoaded = () => loadedOnce;
export function markCoursesLoaded() { if (!loadedOnce) { loadedOnce = true; changed(); } }

export const subscribeCourses = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
/** COURSES, re-rendering when runtime courses change. */
export const useCourses = () => { useSyncExternalStore(subscribeCourses, () => version); return COURSES; };
