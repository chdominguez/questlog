/**
 * Loads every course under /courses/<id>/course.{ts,json} and the private courses folder (alias @private,
 * env QUESTLOG_COURSES). Ids are qualified as "<course>:<id>" so progress, answers and art never collide.
 */
import { addArt } from "../art";
import { mapOrder } from "../engine/levels";
import { CourseSchema, formatIssues, type Challenge, type CourseInput, type Kata, type Level } from "./schema";

export interface Course extends Omit<CourseInput, "katas" | "levels"> {
  levels: Level[]; // map order, boss last; ids qualified
  katas: Record<string, Kata>; // by qualified id
}

export const q = (course: string, id: string) => `${course}:${id}`;
export const courseOf = (key: string) => key.slice(0, key.indexOf(":"));
export const local = (key: string) => key.slice(key.indexOf(":") + 1);

export function resolve(c: CourseInput): Course {
  const Q = (id: string) => q(c.id, id);
  const art = (k: string) => (c.art?.[k] ? Q(k) : k);
  const levels = mapOrder(c.levels.map((l) => ({
      ...l,
      id: Q(l.id),
      ...(l.art && { art: art(l.art) }),
      theory: l.theory.map((t) => ({ ...t, blocks: t.blocks.map((b) => (b.kind === "figure" ? { ...b, art: art(b.art) } : b)) })),
      challenges: l.challenges.map((ch) => ({ ...ch, id: Q(ch.id), ...(ch.type === "kata" && { kataId: Q(ch.kataId) }) }) as Challenge),
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
    courses.push(resolve(r.data));
  }
  return { courses: courses.sort((a, b) => a.title.localeCompare(b.title)), errors };
}

const mods = import.meta.glob<{ default: unknown }>(["/courses/*/course.ts", "/courses/*/course.json", "@private/*/course.ts", "@private/*/course.json"], { eager: true });
const loaded = load(mods);
for (const e of loaded.errors) console.error(`Course ${e.file} skipped:\n${e.error}`);
for (const c of loaded.courses) if (c.art) addArt(Object.fromEntries(Object.entries(c.art).map(([k, v]) => [q(c.id, k), v])));

export const COURSES = loaded.courses;
export const COURSE_ERRORS = loaded.errors;
export const courseById = (id: string) => COURSES.find((c) => c.id === id);
export const levelByKey = (key: string) => courseById(courseOf(key))?.levels.find((l) => l.id === key);
export const kataByKey = (key: string) => courseById(courseOf(key))?.katas[key];

/** Every challenge by qualified id, with its level. */
export const CHALLENGES: Record<string, Challenge & { levelId: string }> = Object.fromEntries(
  COURSES.flatMap((c) => c.levels.flatMap((l) => l.challenges.map((ch) => [ch.id, { ...ch, levelId: l.id }]))),
);
