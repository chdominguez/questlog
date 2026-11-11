// Usage: npx tsx scripts/import-answers.ts <answers.jsonl> --course <id> [--remote]
// Imports SavedAnswer records from the old Node server's JSONL into D1 (local by default). Re-running is safe: ids are kept.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { SavedAnswer } from "../shared/api-types";

const lit = (v: unknown) =>
  typeof v === "string" ? `'${v.replaceAll("\0", "").replaceAll("'", "''")}'` : typeof v === "number" && Number.isFinite(v) ? String(v) : "NULL";
const qualify = (course: string, id: string) => (id.includes(":") ? id : `${course}:${id}`);

/** INSERT OR IGNORE statements for every valid line; returns them and the count of skipped lines. */
export function toSql(jsonl: string, course: string): { sql: string; count: number; skipped: number } {
  const rows: string[] = [];
  let skipped = 0;
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    let a: SavedAnswer;
    try { a = JSON.parse(line); } catch { skipped++; continue; }
    if (![a?.id, a.challengeId, a.levelId, a.prompt, a.answer, a.source, a.createdAt].every((v) => typeof v === "string")) { skipped++; continue; }
    const challengeId = qualify(course, a.challengeId);
    const values = [a.id, challengeId.slice(0, challengeId.indexOf(":")), challengeId, qualify(course, a.levelId), a.prompt, a.answer, a.source,
      a.seconds, a.grade ? JSON.stringify(a.grade) : null, a.selfScore, a.createdAt];
    rows.push(`INSERT OR IGNORE INTO answers VALUES (${values.map(lit).join(", ")});`);
  }
  return { sql: rows.join("\n"), count: rows.length, skipped };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--course");
  const course = args[args.indexOf("--course") + 1];
  if (!file || !args.includes("--course") || !/^[a-z0-9][a-z0-9-]*$/.test(course ?? "")) {
    console.error("Usage: npx tsx scripts/import-answers.ts <answers.jsonl> --course <id> [--remote]");
    process.exit(1);
  }
  const { sql, count, skipped } = toSql(readFileSync(file, "utf8"), course);
  if (!count) { console.error("No answers to import"); process.exit(1); }
  const out = join(mkdtempSync(join(tmpdir(), "questlog-import-")), "answers.sql");
  writeFileSync(out, sql);
  console.log(`${count} answers${skipped ? `, ${skipped} invalid lines skipped` : ""} → ${out}`);
  const r = spawnSync("npx", ["wrangler", "d1", "execute", "DB", "--file", out, args.includes("--remote") ? "--remote" : "--local"], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}
