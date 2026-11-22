import { Hono } from "hono";
import { beforeEach, expect, test } from "vitest";
import { PLAN } from "../shared/pricing";
import type { App, Env } from "./api";
import { balance, charge, credits, grant, refund, spend } from "./credits";
import { memoryDb, type Db } from "./db";
import { testEnv } from "./env";

let db: Db;
let env: Env;
beforeEach(() => {
  db = memoryDb();
  env = testEnv(db, { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x" });
});

const future = new Date(Date.now() + 30 * 86_400_000).toISOString();
const rows = (kind?: string) => db.tx((q) => q.all<{ kind: string; plan_delta: number; topup_delta: number }>(
  `SELECT kind, plan_delta, topup_delta FROM credit_ledger ${kind ? "WHERE kind = ?" : ""} ORDER BY created_at`, ...(kind ? [kind] : [])));
/** The balance cache must equal the ledger sums after every operation. */
function check(user = "u") {
  const sums = db.tx((q) => q.get("SELECT coalesce(sum(plan_delta), 0) AS plan, coalesce(sum(topup_delta), 0) AS topup FROM credit_ledger WHERE user_id = ?", user));
  const cache = db.tx((q) => q.get("SELECT plan, topup FROM credit_balances WHERE user_id = ?", user)) ?? { plan: 0, topup: 0 };
  expect(cache).toEqual(sums);
}
const planGrant = (id: string, periodEnd = future, user = "u") =>
  grant(db, { user, kind: "plan_grant", plan: PLAN.credits, source: "stripe_invoice", sourceId: id, periodEnd });
const pack = (id: string, n = 500, user = "u") => grant(db, { user, kind: "pack", topup: n, source: "stripe_checkout", sourceId: id });
const sp = (key: string, action: "grade" | "course_files" | "course_topic" | "improve" = "grade", allowFree = false) =>
  spend(db, env, { user: "u", action, key, ref: "r", allowFree });

test("billing off: spends pass with no spend id and nothing is written", () => {
  const off = testEnv(db);
  expect(spend(db, off, { user: "u", action: "course_web", key: "k", ref: "r" })).toEqual({ ok: true, spendId: null, free: false, replay: false, balance: 0 });
  expect(credits(db, off, "u")).toBeNull();
  expect(rows()).toEqual([]);
});

test("spend: 402 data when short, plan credits spent first, one row with both deltas", () => {
  expect(sp("a")).toEqual({ ok: false, code: "insufficient_credits", cost: 2, balance: 0 });
  planGrant("in_1");
  pack("cs_1");
  for (let i = 0; i < 6; i++) expect(sp(`f${i}`, "course_files").ok).toBe(true); // 900 of 1000 plan
  check();
  expect(balance(db, "u")).toMatchObject({ plan: 100, topup: 500, total: 600 });
  const r = sp("split", "course_files");
  expect(r).toMatchObject({ ok: true, balance: 450 });
  expect(rows("spend").at(-1)).toEqual({ kind: "spend", plan_delta: -100, topup_delta: -50 });
  expect(balance(db, "u")).toMatchObject({ plan: 0, topup: 450 });
  check();
});

test("spend idempotency: replay charges once; another action, ref or a refunded key conflicts", () => {
  pack("cs_1", 10);
  const first = sp("k");
  expect(first).toMatchObject({ ok: true, replay: false, balance: 8 });
  expect(sp("k")).toMatchObject({ ok: true, replay: true, balance: 8, spendId: first.ok && first.spendId });
  expect(rows("spend")).toHaveLength(1);
  expect(sp("k", "improve")).toMatchObject({ ok: false, code: "idempotency_conflict" });
  expect(spend(db, env, { user: "u", action: "grade", key: "k", ref: "other" })).toMatchObject({ ok: false, code: "idempotency_conflict" });
  refund(db, (first as { spendId: string }).spendId);
  expect(sp("k")).toMatchObject({ ok: false, code: "idempotency_conflict", balance: 10 });
  check();
});

test("refund mirrors a spend once", () => {
  planGrant("in_1");
  pack("cs_1");
  sp("a", "course_files");
  const s = sp("b", "course_files") as { spendId: string };
  expect(refund(db, s.spendId, "build failed")).toBe(true);
  expect(refund(db, s.spendId)).toBe(false);
  expect(refund(db, "nope")).toBe(false);
  expect(rows("refund")).toEqual([{ kind: "refund", plan_delta: 150, topup_delta: 0 }]);
  expect(balance(db, "u").total).toBe(1350);
  check();
});

test("monthly grant resets plan credits (no rollover); top-ups untouched", () => {
  planGrant("in_1");
  pack("cs_1");
  sp("a", "course_files");
  expect(balance(db, "u")).toMatchObject({ plan: 850, topup: 500 });
  expect(planGrant("in_2")).toBe(true);
  expect(balance(db, "u")).toMatchObject({ plan: 1000, topup: 500 });
  expect(rows("plan_expire")).toEqual([{ kind: "plan_expire", plan_delta: -850, topup_delta: 0 }]);
  expect(planGrant("in_2")).toBe(false); // duplicate invoice
  expect(balance(db, "u").plan).toBe(1000);
  check();
});

test("plan credits expire lazily once after period end + grace; top-ups never expire", () => {
  const end = new Date(Date.now() - 2 * 86_400_000).toISOString();
  planGrant("in_1", end);
  pack("cs_1");
  const later = new Date();
  expect(balance(db, "u", later)).toMatchObject({ plan: 0, topup: 500, planExpiresAt: null });
  balance(db, "u", later);
  expect(sp("a")).toMatchObject({ ok: true, balance: 498 });
  expect(rows("plan_expire")).toHaveLength(1);
  check();
  // Within grace the credits are still there.
  planGrant("in_v", new Date(Date.now() - 3_600_000).toISOString(), "v");
  expect(balance(db, "v")).toMatchObject({ plan: 1000 });
});

test("plan credits refunded after the plan ended expire at once", () => {
  const soon = Date.now() + 3_600_000;
  planGrant("in_1", new Date(soon - 86_400_000).toISOString()); // expires in 1 h (period end + 1 day grace)
  pack("cs_1", 10);
  const s = sp("a", "course_files") as { spendId: string };
  const after = new Date(soon + 60_000);
  expect(balance(db, "u", after)).toMatchObject({ plan: 0, topup: 10 });
  expect(refund(db, s.spendId, "build failed", after)).toBe(true);
  expect(balance(db, "u", new Date(soon + 60 * 86_400_000))).toMatchObject({ plan: 0, topup: 10 });
  check();
});

test("free course: once, topic only, restored by refund", () => {
  expect(sp("x", "course_files", true)).toMatchObject({ ok: false, code: "insufficient_credits" });
  const f = sp("a", "course_topic", true) as { spendId: string; free: boolean };
  expect(f).toMatchObject({ ok: true, free: true });
  expect(balance(db, "u").freeCourses).toBe(0);
  expect(sp("a", "course_topic", true)).toMatchObject({ ok: true, free: true, replay: true });
  expect(sp("b", "course_topic", true)).toMatchObject({ ok: false, code: "insufficient_credits", cost: 100 });
  expect(refund(db, f.spendId)).toBe(true);
  expect(balance(db, "u").freeCourses).toBe(1);
  expect(rows().map((r) => r.kind)).toEqual(["free_course", "free_refund"]);
  check();
});

test("credits(): costs, thresholds, subscription and notice", () => {
  planGrant("in_1");
  db.tx((q) => q.run("INSERT INTO subscriptions VALUES ('stripe', 'sub_1', 'u', NULL, 'active', ?, 0, ?)", future, future));
  const c = credits(db, { ...env, CREDITS_NOTICE: "New costs" }, "u")!;
  expect(c).toMatchObject({ plan: 1000, topup: 0, total: 1000, freeCourses: 1, confirmAt: 100, lowAt: 100, notice: "New costs" });
  expect(c.costs.course_topic).toBe(100);
  expect(c.subscription).toEqual({ provider: "stripe", status: "active", periodEnd: future, cancelAtPeriodEnd: false });
  expect(c.planExpiresAt! > future).toBe(true);
});

// charge() through a minimal app with a signed-in user.
const app = (run: () => Promise<Response>) => new Hono<App>()
  .use("*", async (c, next) => { c.set("user", "u"); await next(); })
  .post("/x", (c) => charge(c, "grade", "t:w", run));
const call = (a: Hono<App>, key: string) => a.request("/x", { method: "POST", headers: { "Idempotency-Key": key } }, env);

test("charge: 402 before the call, balance header, refund + 502 on throw", async () => {
  let calls = 0;
  const ok = app(async () => { calls++; return new Response("{}", { headers: { "content-type": "application/json" } }); });
  const res = await call(ok, "a");
  expect(res.status).toBe(402);
  expect(await res.json()).toMatchObject({ code: "insufficient_credits", cost: 2, balance: 0, action: "grade" });
  expect(res.headers.get("x-credits-balance")).toBe("0");
  expect(calls).toBe(0);
  pack("cs_1", 10);
  const bad = await call(app(async () => { throw new Error("model down"); }), "b");
  expect(bad.status).toBe(502);
  expect(await bad.json()).toMatchObject({ code: "ai_failed", refunded: true });
  expect(bad.headers.get("x-credits-balance")).toBe("10");
  check();
});

test("charge: a duplicate while the first call runs gets 409 in_progress; afterwards a replay gets 409 and never runs", async () => {
  pack("cs_1", 10);
  let release!: () => void, runs = 0;
  const gate = new Promise<void>((r) => { release = r; });
  const a = app(async () => { runs++; await gate; return Response.json({ ok: 1 }); });
  const first = call(a, "k");
  await new Promise((r) => setTimeout(r, 0));
  const dup = await call(a, "k");
  expect(dup.status).toBe(409);
  expect((await dup.json()).code).toBe("in_progress");
  release();
  expect((await first).status).toBe(200);
  const again = await call(a, "k");
  expect(again.status).toBe(409);
  expect((await again.json()).code).toBe("idempotency_conflict");
  expect(runs).toBe(1);
  expect(balance(db, "u").total).toBe(8);
  check();
});

test("concurrent charges never overdraw", async () => {
  pack("cs_1", 10);
  const a = app(async () => { await new Promise((r) => setTimeout(r, 1)); return Response.json({}); });
  const res = await Promise.all(Array.from({ length: 10 }, (_, i) => call(a, `k${i}`)));
  expect(res.filter((r) => r.status === 200)).toHaveLength(5);
  expect(res.filter((r) => r.status === 402)).toHaveLength(5);
  expect(balance(db, "u").total).toBe(0);
  check();
});
