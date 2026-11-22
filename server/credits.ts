import { Hono, type Context } from "hono";
import type { Action, Credits, LedgerKind } from "../shared/api-types";
import type { App, Deps } from "./api";
import type { Db } from "./db";
import type { Env } from "./env";
import { err } from "./errors";

// Stub until WP4 (credits): billing off. Spends always pass, nothing is written.

export function metered(_env: Env): boolean { return false; }

export function balance(_db: Db, _user: string, _now?: Date): { plan: number; topup: number; total: number; planExpiresAt: string | null; freeCourses: number } {
  return { plan: 0, topup: 0, total: 0, planExpiresAt: null, freeCourses: 0 };
}

export function credits(_db: Db, _env: Env, _user: string): Credits | null { return null; }

export function spend(_db: Db, _env: Env, _a: { user: string; action: Action; key: string; ref: string; allowFree?: boolean }):
  | { ok: true; spendId: string | null; free: boolean; replay: boolean; balance: number }
  | { ok: false; code: "insufficient_credits" | "idempotency_conflict" | "in_progress"; cost: number; balance: number } {
  return { ok: true, spendId: null, free: false, replay: false, balance: 0 };
}

/** Also undoes a free course. False when there was nothing to refund. */
export function refund(_db: Db, _spendId: string, _note?: string): boolean { return false; }

export function grant(_db: Db, _g: { user: string; kind: LedgerKind; plan?: number; topup?: number; source: string; sourceId: string; ref?: string; note?: string; periodEnd?: string }): boolean {
  return false;
}

/** spend -> 402/409 response; run(); on throw: refund + 502 ai_failed { refunded }; sets x-credits-balance. */
export async function charge(c: Context<App>, _action: Action, _ref: string, run: () => Promise<Response>): Promise<Response> {
  try { return await run(); } catch (e) {
    console.error("ai call failed:", e);
    return err(c, 502, "ai_failed", { refunded: false });
  }
}

const off = (c: Context) => err(c, 503, "not_configured");

/** Public: /webhooks/*. */
export function billingPublic(_deps: Deps): Hono<App> {
  return new Hono<App>().post("/webhooks/stripe", off).post("/webhooks/revenuecat", off);
}

/** Private: /credits*, /billing/*, /admin/credits. */
export function billingRoutes(_deps: Deps): Hono<App> {
  return new Hono<App>()
    .get("/credits", off)
    .get("/credits/ledger", off)
    .post("/billing/checkout", off)
    .post("/billing/portal", off)
    .post("/billing/fulfill", off)
    .post("/admin/credits", off);
}
