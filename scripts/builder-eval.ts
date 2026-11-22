// Builder eval (BLD-13): builds each topic with the real Anthropic API and reports the outcome and token usage per build.
// Costs money, so it is run by hand, never in CI. From the repo root:
//   npm run build:server && npx vite build --ssr scripts/builder-eval.ts --outDir dist-server/eval
//   ANTHROPIC_API_KEY=... node dist-server/eval/builder-eval.js [topics.txt]   (one topic per line)
import { readFileSync } from "node:fs";
import { defaultDeps } from "../server/api";
import "../server/builder"; // registers the build handler
import { memoryDb } from "../server/db";
import { testEnv } from "../server/env";
import { enqueue, startJobs, type JobRow } from "../server/jobs";

const TOPICS = ["Rust ownership and borrowing", "SQL window functions", "HTTP caching headers", "Git rebase vs merge", "Python asyncio basics"];
const topics = process.argv[2] ? readFileSync(process.argv[2], "utf8").split("\n").map((t) => t.trim()).filter(Boolean) : TOPICS;

if (!process.env.ANTHROPIC_API_KEY) { console.error("Set ANTHROPIC_API_KEY"); process.exit(1); }
const db = memoryDb();
const env = testEnv(db, { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, JOB_CONCURRENCY: 1 });
const stop = startJobs(env, defaultDeps());

let ok = 0;
for (const topic of topics) {
  const t0 = Date.now();
  const id = enqueue(db, { user: "eval", kind: "build", title: topic, input: { mode: "topic", topic, level: "intermediate", lang: "en" }, spendId: null });
  let row: JobRow | undefined;
  while ((row = db.tx((q) => q.get<JobRow & { usage: string | null }>("SELECT * FROM jobs WHERE id = ?", id)))!.status !== "done" && row!.status !== "failed") {
    await new Promise((r) => setTimeout(r, 1000));
  }
  const r = row as JobRow & { usage: string | null };
  const events = db.tx((q) => q.all<{ type: string; data: string }>("SELECT type, data FROM job_events WHERE job_id = ? AND type = 'problems'", id));
  if (r.status === "done") ok++;
  console.log(JSON.stringify({
    topic, status: r.status, error: r.error && JSON.parse(r.error), fixRounds: events.length,
    seconds: Math.round((Date.now() - t0) / 1000), usage: r.usage && JSON.parse(r.usage),
  }));
}
stop();
console.log(`${ok}/${topics.length} built`);
