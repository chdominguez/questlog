// Usage: npm run validate [course-id-or-folder ...]   Checks every course (or the given ones) and exits 1 on any problem.
import { globSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validateCourse } from "../src/course/validate";

const roots = ["courses", process.env.QUESTLOG_COURSES ?? "courses-private"];
const files = roots.flatMap((r) => globSync(`${r}/*/course.{ts,json}`)).map((f) => resolve(f));
const wanted = process.argv.slice(2);
const pick = wanted.length ? files.filter((f) => wanted.some((w) => basename(dirname(f)) === w || f.startsWith(resolve(w)))) : files;
if (!pick.length) { console.error(wanted.length ? `No course matches ${wanted.join(", ")}` : "No courses found"); process.exit(1); }

let bad = 0;
for (const f of pick) {
  let problems: string[];
  try {
    const m = await import(pathToFileURL(f).href, f.endsWith(".json") ? { with: { type: "json" } } : undefined);
    problems = validateCourse(m.default);
  } catch (e) {
    problems = [`failed to load: ${e instanceof Error ? e.message : e}`];
  }
  console.log(`${problems.length ? "✗" : "✓"} ${f}`);
  for (const p of problems) console.log(`  ${p}`);
  if (problems.length) bad++;
}
process.exit(bad ? 1 : 0);
