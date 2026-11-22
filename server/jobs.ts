import type { JobEvent } from "../shared/api-types";
import type { Deps } from "./api";
import type { Db } from "./db";
import type { Env } from "./env";
import { refund } from "./credits";

// Stub until WP5 (builder): runs each job inline on setImmediate, nothing persisted.

export class JobError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export type JobHandler = (
  job: { id: string; user: string; input: unknown },
  ctx: { db: Db; env: Env; deps: Deps; emit(type: JobEvent["type"], data: object): void },
) => Promise<object>;

const handlers = new Map<string, JobHandler>();
let running: { env: Env; deps: Deps } | null = null;

export function registerJob(kind: "build" | "narration", h: JobHandler): void { handlers.set(kind, h); }

export function enqueue(db: Db, j: { user: string; kind: "build" | "narration"; title?: string; input: unknown; spendId: string | null }): string {
  const id = crypto.randomUUID();
  const h = handlers.get(j.kind);
  const ctx = running;
  if (h && ctx) {
    setImmediate(() => {
      h({ id, user: j.user, input: j.input }, { db, ...ctx, emit: () => {} })
        .catch((e) => { console.error(`job ${id} failed:`, e); if (j.spendId) refund(db, j.spendId); });
    });
  }
  return id;
}

/** Starts the worker; returns stop. */
export function startJobs(env: Env, deps: Deps): () => void {
  running = { env, deps };
  return () => { running = null; };
}
