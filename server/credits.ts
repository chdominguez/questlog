import type { Context } from "hono";
import type { Action, Credits, LedgerKind } from "../shared/api-types";
import { COSTS, CONFIRM_AT, FREE_COURSES, LOW_BALANCE, PLAN_GRACE_DAYS } from "../shared/pricing";
import type { App } from "./api";
import type { Db, Tx } from "./db";
import type { Env } from "./env";
import { err } from "./errors";

export { billingPublic, billingRoutes } from "./billing";

/** Billing and metering are on only with both Stripe vars (BIL-7). */
export const metered = (env: Env): boolean => !!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);

type BalanceRow = { plan: number; topup: number; plan_expires_at: string | null; free_courses_used: number };
type LedgerRowDb = { id: string; user_id: string; kind: LedgerKind; plan_delta: number; topup_delta: number; action: Action | null; ref: string | null };

const row = (q: Tx, user: string): BalanceRow =>
  q.get<BalanceRow>("SELECT plan, topup, plan_expires_at, free_courses_used FROM credit_balances WHERE user_id = ?", user)
  ?? { plan: 0, topup: 0, plan_expires_at: null, free_courses_used: 0 };

/** Appends one ledger row and moves the balance cache with it. False when (source, source_id) already exists. */
function write(q: Tx, user: string, r: { kind: LedgerKind; plan?: number; topup?: number; free?: number; action?: Action | null; source: string; sourceId: string; ref?: string | null; note?: string | null; expiresAt?: string }): string | null {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const added = q.run(
    `INSERT OR IGNORE INTO credit_ledger (id, user_id, kind, plan_delta, topup_delta, action, source, source_id, ref, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, user, r.kind, r.plan ?? 0, r.topup ?? 0, r.action ?? null, r.source, r.sourceId, r.ref ?? null, r.note ?? null, now,
  );
  if (!added) return null;
  q.run(
    `INSERT INTO credit_balances (user_id, plan, topup, plan_expires_at, free_courses_used, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET plan = plan + excluded.plan, topup = topup + excluded.topup,
       plan_expires_at = coalesce(excluded.plan_expires_at, plan_expires_at), free_courses_used = free_courses_used + excluded.free_courses_used, updated_at = excluded.updated_at`,
    user, r.plan ?? 0, r.topup ?? 0, r.expiresAt ?? null, r.free ?? 0, now,
  );
  return id;
}

/** Lazy expiry: plan credits past plan_expires_at go once (source_id = <user>:<plan_expires_at>). */
function expire(q: Tx, user: string, now: Date) {
  const b = row(q, user);
  if (b.plan > 0 && b.plan_expires_at && b.plan_expires_at < now.toISOString()) {
    write(q, user, { kind: "plan_expire", plan: -b.plan, source: "expire", sourceId: `${user}:${b.plan_expires_at}` });
  }
}

function read(q: Tx, user: string, now: Date) {
  expire(q, user, now);
  const b = row(q, user);
  return {
    plan: b.plan, topup: b.topup, total: b.plan + b.topup,
    planExpiresAt: b.plan_expires_at && b.plan_expires_at >= now.toISOString() ? b.plan_expires_at : null,
    freeCourses: Math.max(0, FREE_COURSES - b.free_courses_used),
  };
}

export function balance(db: Db, user: string, now = new Date()) {
  return db.tx((q) => read(q, user, now));
}

const ACTIVE = "status IN ('active', 'past_due')";

export function credits(db: Db, env: Env, user: string): Credits | null {
  if (!metered(env)) return null;
  const b = balance(db, user);
  const s = db.tx((q) => q.get<{ provider: "stripe" | "revenuecat"; store: string | null; status: "active" | "past_due" | "canceled" | "expired"; period_end: string | null; cancel_at_period_end: number }>(
    `SELECT provider, store, status, period_end, cancel_at_period_end FROM subscriptions WHERE user_id = ?
     ORDER BY ${ACTIVE} DESC, updated_at DESC LIMIT 1`, user));
  return {
    ...b,
    subscription: s ? {
      provider: s.provider, ...(s.store && { store: s.store as "app_store" | "play_store" }), status: s.status,
      periodEnd: s.period_end, cancelAtPeriodEnd: !!s.cancel_at_period_end,
    } : null,
    costs: { ...COSTS }, confirmAt: CONFIRM_AT, lowAt: LOW_BALANCE,
    ...(env.CREDITS_NOTICE && { notice: env.CREDITS_NOTICE }),
  };
}

/** True when the user has an active or past-due plan on any provider. */
export const subscribed = (q: Tx, user: string) => !!q.get(`SELECT 1 FROM subscriptions WHERE user_id = ? AND ${ACTIVE}`, user);

// Keys whose charged call is still running; a duplicate meanwhile gets 409 in_progress instead of a second model call.
const inflight = new Set<string>();

export function spend(db: Db, env: Env, a: { user: string; action: Action; key: string; ref: string; allowFree?: boolean }):
  | { ok: true; spendId: string | null; free: boolean; replay: boolean; balance: number }
  | { ok: false; code: "insufficient_credits" | "idempotency_conflict" | "in_progress"; cost: number; balance: number } {
  const cost = COSTS[a.action];
  if (!metered(env)) return { ok: true, spendId: null, free: false, replay: false, balance: 0 };
  const sourceId = `${a.user}:${a.key}`;
  return db.tx((q) => {
    const total = () => read(q, a.user, new Date()).total;
    if (inflight.has(sourceId)) return { ok: false, code: "in_progress", cost, balance: total() };
    const prev = q.get<LedgerRowDb>("SELECT * FROM credit_ledger WHERE source IN ('spend', 'free') AND source_id = ?", sourceId);
    if (prev) {
      const refunded = !!q.get("SELECT 1 FROM credit_ledger WHERE source = 'refund' AND source_id = ?", prev.id);
      if (prev.action !== a.action || prev.ref !== a.ref || refunded) return { ok: false, code: "idempotency_conflict", cost, balance: total() };
      return { ok: true, spendId: prev.id, free: prev.kind === "free_course", replay: true, balance: total() };
    }
    const b = read(q, a.user, new Date());
    if (a.allowFree && a.action === "course_topic" && b.freeCourses > 0) {
      const id = write(q, a.user, { kind: "free_course", free: 1, action: a.action, source: "free", sourceId, ref: a.ref })!;
      return { ok: true, spendId: id, free: true, replay: false, balance: b.total };
    }
    if (b.total < cost) return { ok: false, code: "insufficient_credits", cost, balance: b.total };
    const fromPlan = Math.min(Math.max(b.plan, 0), cost);
    const id = write(q, a.user, { kind: "spend", plan: -fromPlan, topup: -(cost - fromPlan), action: a.action, source: "spend", sourceId, ref: a.ref })!;
    return { ok: true, spendId: id, free: false, replay: false, balance: b.total - cost };
  });
}

/** Mirrors a spend once (also undoes a free course). False when there was nothing to refund. Plan credits refunded after the plan ended or renewed expire at once. */
export function refund(db: Db, spendId: string, note?: string, now = new Date()): boolean {
  return db.tx((q) => {
    const s = q.get<LedgerRowDb>("SELECT * FROM credit_ledger WHERE id = ? AND kind IN ('spend', 'free_course')", spendId);
    if (!s) return false;
    const free = s.kind === "free_course";
    const done = !!write(q, s.user_id, {
      kind: free ? "free_refund" : "refund", plan: -s.plan_delta, topup: -s.topup_delta, free: free ? -1 : 0,
      action: s.action, source: "refund", sourceId: s.id, ref: s.ref, note,
    });
    const end = row(q, s.user_id).plan_expires_at;
    // Plan credits from an ended period, or from before a renewal grant, don't come back into the current one.
    const renewed = !!q.get("SELECT 1 FROM credit_ledger WHERE user_id = ? AND kind = 'plan_grant' AND rowid > (SELECT rowid FROM credit_ledger WHERE id = ?)", s.user_id, s.id);
    if (done && s.plan_delta < 0 && ((end && end < now.toISOString()) || renewed)) {
      write(q, s.user_id, { kind: "plan_expire", plan: s.plan_delta, source: "expire", sourceId: `refund:${s.id}` });
    }
    return done;
  });
}

export type GrantInput = { user: string; kind: LedgerKind; plan?: number; topup?: number; source: string; sourceId: string; ref?: string; note?: string; periodEnd?: string };

/** grant inside an open tx. A plan grant expires leftover plan credits first, then sets the plan to `plan` (no rollover). */
export function grantTx(q: Tx, g: GrantInput): boolean {
  if (q.get("SELECT 1 FROM credit_ledger WHERE source = ? AND source_id = ?", g.source, g.sourceId)) return false;
  let expiresAt: string | undefined;
  if (g.kind === "plan_grant") {
    const left = row(q, g.user).plan;
    if (left > 0) write(q, g.user, { kind: "plan_expire", plan: -left, source: "expire", sourceId: `${g.source}:${g.sourceId}` });
    if (g.periodEnd) expiresAt = new Date(Date.parse(g.periodEnd) + PLAN_GRACE_DAYS * 86_400_000).toISOString();
  }
  return !!write(q, g.user, { kind: g.kind, plan: g.plan, topup: g.topup, source: g.source, sourceId: g.sourceId, ref: g.ref, note: g.note, expiresAt });
}

/** False on a duplicate (source, sourceId). */
export function grant(db: Db, g: GrantInput): boolean {
  return db.tx((q) => grantTx(q, g));
}

/** spend -> 402/409 response; run(); on throw: refund + 502 ai_failed { refunded }; sets x-credits-balance. */
export async function charge(c: Context<App>, action: Action, ref: string, run: (spendId: string | null) => Promise<Response>): Promise<Response> {
  const db = c.env.DB, user = c.get("user");
  const key = c.req.header("idempotency-key")?.slice(0, 200) || crypto.randomUUID();
  const s = spend(db, c.env, { user, action, key, ref });
  const on = metered(c.env);
  if (on) c.header("x-credits-balance", String(s.balance));
  if (!s.ok) {
    return s.code === "insufficient_credits"
      ? err(c, 402, "insufficient_credits", { action, cost: s.cost, balance: s.balance })
      : err(c, 409, s.code);
  }
  // The paid call already ran for this key: never run the model again for free.
  if (s.replay) return err(c, 409, "idempotency_conflict");
  const k = `${user}:${key}`;
  if (on) inflight.add(k);
  try {
    return await run(s.spendId);
  } catch (e) {
    console.error("ai call failed:", e);
    const refunded = !!s.spendId && refund(db, s.spendId, "ai_failed");
    if (on) c.header("x-credits-balance", String(balance(db, user).total));
    return err(c, 502, "ai_failed", { refunded });
  } finally {
    inflight.delete(k);
  }
}
