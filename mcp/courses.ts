/** Course files on disk for the MCP server: found the same way as scripts/validate.ts, saved as `<root>/<id>/course.json`. */
import { existsSync, globSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mediaRefProblem } from "../shared/media";
import { COURSE_DIR } from "../server/media";
import { validateCourse } from "../src/course/validate";

export type Visibility = "public" | "private";
export type Roots = Record<Visibility, string>;
export interface CourseFile { id: string; file: string; visibility: Visibility }

export const defaultRoots = (): Roots => ({ public: resolve("courses"), private: resolve(process.env.QUESTLOG_COURSES ?? "courses-private") });

export function findCourses(roots: Roots): CourseFile[] {
  return (Object.keys(roots) as Visibility[]).flatMap((visibility) =>
    globSync(`${roots[visibility]}/*/course.{ts,json}`).map((f) => ({ id: basename(dirname(f)), file: resolve(f), visibility })));
}

// shortcut: TS courses are imported once per process, so edits to a course.ts show after a server restart; spawn tsx per load if that bites.
export async function loadCourse(file: string): Promise<unknown> {
  return file.endsWith(".json") ? JSON.parse(readFileSync(file, "utf8")) : (await import(pathToFileURL(file).href)).default;
}

export async function listCourses(roots: Roots) {
  return Promise.all(findCourses(roots).map(async ({ id, file, visibility }) => {
    try {
      const c = (await loadCourse(file)) as { id?: string; title?: string; lang?: string; levels?: unknown[]; katas?: unknown[] };
      return { id: c.id ?? id, title: c.title, lang: c.lang, levels: c.levels?.length ?? 0, katas: c.katas?.length ?? 0, file, visibility };
    } catch (e) {
      return { id, file, visibility, error: `failed to load: ${e instanceof Error ? e.message : e}` };
    }
  }));
}

/** Writes a valid course as JSON. Returns the path written, or an error the caller can act on. */
export function saveCourse(course: unknown, visibility: Visibility, overwrite: boolean, roots: Roots): { path: string } | { error: string } {
  const problems = validateCourse(course);
  if (problems.length) return { error: `Course is invalid, nothing was written. Fix these and call course_save again:\n${problems.join("\n")}` };
  const id = (course as { id: string }).id;
  const path = resolve(roots[visibility], id, "course.json");
  for (const c of findCourses(roots).filter((c) => c.id === id)) {
    if (c.file.endsWith(".ts")) return { error: `Course "${id}" is a TypeScript course at ${c.file}; edit that file instead, or use another id.` };
    if (c.file !== path) return { error: `Course "${id}" already exists as a ${c.visibility} course at ${c.file}; use another id.` };
    if (!overwrite) return { error: `${path} already exists. Call course_save again with overwrite: true to replace it.` };
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(course, null, 2)}\n`);
  return { path };
}

export const MAX_MEDIA_BYTES = () => Number(process.env.MEDIA_MAX_BYTES ?? 50 * 1024 * 1024);

/** Writes a media file for a course; returns the `media/<file>` ref to use in a course block. */
export function uploadMedia(root: string, course: string, filename: string, bytes: Buffer, overwrite: boolean): { ref: string; bytes: number } | { error: string } {
  if (!COURSE_DIR.test(course)) return { error: `Course id "${course}" must be lowercase letters, digits and dashes.` };
  const p = mediaRefProblem(`media/${filename}`);
  if (p) return { error: `filename ${p}` };
  if (!bytes.length) return { error: "File is empty." };
  if (bytes.length > MAX_MEDIA_BYTES()) return { error: `File is ${bytes.length} bytes; the limit is ${MAX_MEDIA_BYTES()} (env MEDIA_MAX_BYTES).` };
  const path = resolve(root, course, filename);
  if (existsSync(path) && !overwrite) return { error: `media/${filename} already exists for ${course}. Call media_upload again with overwrite: true to replace it.` };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  return { ref: `media/${filename}`, bytes: bytes.length };
}

export function listMedia(root: string, course: string): { ref: string; bytes: number }[] | { error: string } {
  if (!COURSE_DIR.test(course)) return { error: `Course id "${course}" must be lowercase letters, digits and dashes.` };
  const dir = resolve(root, course);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => mediaRefProblem(`media/${f}`) === null).sort().map((f) => ({ ref: `media/${f}`, bytes: statSync(resolve(dir, f)).size }));
}
