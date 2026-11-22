// Usage: npx tsx scripts/export-course.ts <id> [--db <file>]
// Writes an approved user course from the SQLite file (default data/questlog.db) to courses/<id>/course.json, for a library PR (LIB-7).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { openDb, type Db } from "../server/db";
import { validateCourse } from "../src/course/validate";

/** Writes `<root>/<id>/course.json` for a public course and returns the path; throws when missing, not public or invalid. */
export async function exportCourse(db: Db, id: string, root = "courses"): Promise<string> {
  const row = await db.prepare("SELECT json, status FROM user_courses WHERE id = ?").bind(id).first<{ json: string; status: string }>();
  if (!row) throw new Error(`Course ${id} not found`);
  if (row.status !== "public") throw new Error(`Course ${id} is ${row.status}, not public`);
  const course = JSON.parse(row.json);
  const problems = validateCourse(course);
  if (problems.length) throw new Error(`Course ${id} is invalid:\n${problems.join("\n")}`);
  const file = join(root, id, "course.json");
  mkdirSync(join(root, id), { recursive: true });
  writeFileSync(file, `${JSON.stringify(course, null, 2)}\n`);
  return file;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const db = args.includes("--db") ? args[args.indexOf("--db") + 1] : process.env.DB_PATH ?? "data/questlog.db";
  const id = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--db");
  if (!id) {
    console.error("Usage: npx tsx scripts/export-course.ts <id> [--db <file>]");
    process.exit(1);
  }
  try {
    console.log(`Wrote ${await exportCourse(openDb(db), id)}`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
