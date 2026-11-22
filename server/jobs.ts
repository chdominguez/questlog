import type { Job, JobEvent } from "../shared/api-types";
import type { Deps } from "./api";
import type { Db, Tx } from "./db";
import type { Env } from "./env";
import { refund } from "./credits";

export class JobError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export type JobHandler = (
  job: { id: string; user: string; input: unknown },
  ctx: { db: Db; env: Env; deps: Deps; emit(type: JobEvent["type"], data: object): void },
) => Promise<object>;

type Sweep = (ctx: { db: Db; env: Env; deps: Deps }) => Promise<void>;

export interface JobRow {
  id: string; user_id: string; kind: Job["kind"]; status: Job["status"]; title: string | null; input: string;
  result: string | null; error: string | null; spend_id: string | null; attempts: number; created_at: string; finished_at: string | null;
}

const handlers = new Map<string, JobHandler>();
const sweeps: Sweep[] = [];
let kick: (() => void) | null = null;
const HEARTBEAT_MS = 15_000;
const SWEEP_MS = 60 * 60 * 1000;
const now = () => new Date().toISOString();

export function registerJob(kind: "build" | "narration", h: JobHandler): void { handlers.set(kind, h); }
/** Periodic cleanup run by the worker (hourly and at start). */
export function registerSweep(s: Sweep): void { sweeps.push(s); }

export function enqueue(db: Db, j: { id?: string; user: string; kind: "build" | "narration"; title?: string; input: unknown; spendId: string | null }): string {
  const id = j.id ?? crypto.randomUUID(); // a caller passes the id when its ledger ref must name the job
  db.tx((q) => q.run(
    "INSERT INTO jobs (id, user_id, kind, status, title, input, spend_id, created_at) VALUES (?, ?, ?, 'queued', ?, ?, ?, ?)",
    id, j.user, j.kind, j.title ?? null, JSON.stringify(j.input), j.spendId, now(),
  ));
  queueMicrotask(() => kick?.());
  return id;
}

const addEvent = (q: Tx, id: string, type: JobEvent["type"], data: object) => {
  const seq = (q.get<{ n: number }>("SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM job_events WHERE job_id = ?", id)!).n;
  q.run("INSERT INTO job_events (job_id, seq, at, type, data) VALUES (?, ?, ?, ?, ?)", id, seq, now(), type, JSON.stringify(data));
};

/** Marks the job failed, refunds its spend and adds the "failed" event, in one transaction. */
export function failJob(db: Db, id: string, code: string, message: string) {
  db.tx((q) => {
    const row = q.get<JobRow>("SELECT * FROM jobs WHERE id = ?", id);
    if (!row || row.status === "done" || row.status === "failed") return;
    const joined: Db = { prepare: db.prepare, tx: (fn) => fn(q) }; // refund joins this transaction
    const refunded = row.spend_id ? refund(joined, row.spend_id, `${row.kind} failed`) : false;
    if (refunded && row.kind === "narration") q.run("DELETE FROM narration_unlocks WHERE spend_id = ?", row.spend_id); // the paid unlock goes with its credits
    const free = !!(JSON.parse(row.input) as { free?: boolean }).free;
    q.run("UPDATE jobs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?",
      JSON.stringify({ code, message, refunded, ...(free && refunded && { free: true }) }), now(), id);
    addEvent(q, id, "failed", { code, message, refunded });
  });
}

function finish(db: Db, id: string, result: object) {
  db.tx((q) => {
    q.run("UPDATE jobs SET status = 'done', result = ?, finished_at = ? WHERE id = ? AND status = 'running'", JSON.stringify(result), now(), id);
    addEvent(q, id, "done", result);
  });
}

export const toJob = (r: JobRow): Job => ({
  id: r.id, kind: r.kind, status: r.status, title: r.title,
  ...(r.kind === "build" && { mode: (JSON.parse(r.input) as { mode?: Job["mode"] }).mode }),
  result: r.result ? JSON.parse(r.result) : null, error: r.error ? JSON.parse(r.error) : null,
  createdAt: r.created_at, finishedAt: r.finished_at,
});

export const jobEvents = (db: Db, id: string, after = 0): Promise<JobEvent[]> =>
  db.prepare("SELECT seq, at, type, data FROM job_events WHERE job_id = ? AND seq > ? ORDER BY seq").bind(id, after)
    .all<{ seq: number; at: string; type: JobEvent["type"]; data: string }>()
    .then(({ results }) => results.map((e) => ({ seq: e.seq, at: e.at, type: e.type, data: JSON.parse(e.data) }) as JobEvent));

/** Starts the worker; returns stop. Jobs left running by a dead process are retried once, then failed with a refund. */
export function startJobs(env: Env, deps: Deps): () => void {
  const db = env.DB;
  for (const r of db.tx((q) => q.all<JobRow>("SELECT * FROM jobs WHERE status = 'running'"))) {
    if (r.attempts < 2) db.tx((q) => q.run("UPDATE jobs SET status = 'queued' WHERE id = ?", r.id));
    else failJob(db, r.id, "ai_failed", "Job interrupted");
  }
  const active = { narration: 0, build: 0 }; // one lane per kind, JOB_CONCURRENCY each: builds never hold back narration
  let stopped = false;
  const run = async (job: JobRow) => {
    const beat = setInterval(() => {
      try { db.tx((q) => q.run("UPDATE jobs SET heartbeat_at = ? WHERE id = ?", now(), job.id)); } catch (e) { console.error("job heartbeat failed:", e); }
    }, HEARTBEAT_MS);
    try {
      const h = handlers.get(job.kind);
      if (!h) throw new JobError("ai_failed", `No handler for ${job.kind}`);
      const emit = (type: JobEvent["type"], data: object) => db.tx((q) => addEvent(q, job.id, type, data));
      finish(db, job.id, await h({ id: job.id, user: job.user_id, input: JSON.parse(job.input) }, { db, env, deps, emit }));
    } catch (e) {
      if (!(e instanceof JobError)) console.error(`job ${job.id} failed:`, e);
      failJob(db, job.id, e instanceof JobError ? e.code : "ai_failed", e instanceof JobError ? e.message : "AI request failed");
    } finally {
      clearInterval(beat);
    }
  };
  // Runs from timers: a throw here would end the process, so log it and try again next tick.
  const tick = () => {
    try {
      for (const kind of ["narration", "build"] as const) {
        while (!stopped && active[kind] < env.JOB_CONCURRENCY) {
          const t = now();
          const job = db.tx((q) => q.get<JobRow>(
            `UPDATE jobs SET status = 'running', started_at = ?, heartbeat_at = ?, attempts = attempts + 1
             WHERE id = (SELECT id FROM jobs WHERE status = 'queued' AND kind = ? ORDER BY created_at, rowid LIMIT 1) RETURNING *`, t, t, kind));
          if (!job) break;
          active[kind]++;
          void run(job).finally(() => { active[kind]--; tick(); });
        }
      }
    } catch (e) { console.error("job tick failed:", e); }
  };
  const sweep = () => { for (const s of sweeps) s({ db, env, deps }).catch((e) => console.error("sweep failed:", e)); };
  const timer = setInterval(tick, 1000);
  const sweepTimer = setInterval(sweep, SWEEP_MS);
  kick = tick;
  tick();
  sweep();
  return () => { stopped = true; clearInterval(timer); clearInterval(sweepTimer); kick = null; };
}
