import Stripe from "stripe";
import { beforeEach, expect, test, vi } from "vitest";
import { createApi, type Deps, type Env, type SessionUser } from "./api";
import { cancelForUser } from "./billing";
import { balance } from "./credits";
import { memoryDb, type Db } from "./db";
import { testEnv } from "./env";

const SECRET = "whsec_test";
const real = new Stripe("sk_test_x");
const future = Math.floor(Date.now() / 1000) + 30 * 86400;

let db: Db;
let env: Env;
let stripe: ReturnType<typeof fakeStripe>;
beforeEach(() => {
  db = memoryDb();
  db.tx((q) => q.run(`INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt) VALUES ('u', 'U', 'u@x.com', 1, 0, 0), ('v', 'V', 'v@x.com', 1, 0, 0)`));
  env = testEnv(db, { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: SECRET, REVENUECAT_WEBHOOK_AUTH: "Bearer rc", ADMIN_EMAILS: ["admin@x.com"] });
  stripe = fakeStripe();
});

/** The Stripe calls billing makes; webhooks are the real SDK's (signature checks need no network). */
function fakeStripe() {
  const sessions: Record<string, object> = {}, subs: Record<string, object> = {}, invoices: Record<string, object> = {};
  return {
    sessions, subs, invs: invoices,
    webhooks: real.webhooks,
    customers: { create: vi.fn(async (_p: object, _o?: object) => ({ id: "cus_1" })) },
    prices: { list: vi.fn(async ({ lookup_keys }: { lookup_keys: string[] }) => ({ data: [{ id: `price_${lookup_keys[0]}` }] })) },
    checkout: { sessions: {
      create: vi.fn(async (_p: Stripe.Checkout.SessionCreateParams) => ({ id: "cs_new", url: "https://checkout.stripe.test/cs_new" })),
      retrieve: vi.fn(async (id: string) => { if (!sessions[id]) throw new Error("No such session"); return sessions[id]; }),
    } },
    billingPortal: { sessions: { create: vi.fn(async (_p: object) => ({ url: "https://billing.stripe.test/p" })) } },
    subscriptions: {
      retrieve: vi.fn(async (id: string) => subs[id]),
      list: vi.fn(async () => ({ data: Object.values(subs) })),
      cancel: vi.fn(async (id: string) => ({ id, status: "canceled" })),
    },
    invoices: { retrieve: vi.fn(async (id: string) => invoices[id]) },
  };
}

const account = (id: string): SessionUser => ({ id, email: `${id}@x.com`, name: id, emailVerified: true });
const api = (over: Partial<Deps> = {}) => {
  const app = createApi({ session: async (c) => account(c.req.header("x-test-user") ?? "u"), stripe: () => stripe as unknown as Stripe, ...over });
  return (path: string, init: RequestInit = {}) => app.request(path, init, env);
};
const post = (body: unknown, user = "u") => ({ method: "POST", headers: { "Content-Type": "application/json", "x-test-user": user }, body: JSON.stringify(body) });
let n = 0;
const event = (type: string, object: object, id = `evt_${++n}`) => {
  const payload = JSON.stringify({ id, object: "event", type, data: { object } });
  return { method: "POST", headers: { "stripe-signature": real.webhooks.generateTestHeaderString({ payload, secret: SECRET }) }, body: payload };
};
const kinds = () => db.tx((q) => q.all<{ kind: string; d: number }>("SELECT kind, plan_delta + topup_delta AS d FROM credit_ledger ORDER BY created_at, kind"));
const sub = (id: string, status: string, user = "u") => ({ id, object: "subscription", customer: "cus_1", status, cancel_at_period_end: false, cancel_at: null, metadata: { user_id: user }, items: { data: [{ current_period_end: future }] } });
const invoice = (id: string, reason = "subscription_create") => ({ id, object: "invoice", customer: "cus_1", status: "paid", billing_reason: reason, parent: { subscription_details: { metadata: { user_id: "u" } } }, lines: { data: [{ period: { end: future } }] } });
const packSession = (id: string, user = "u", item = "pack_s") => ({ id, object: "checkout.session", mode: "payment", status: "complete", payment_status: "paid", metadata: { user_id: user, item }, client_reference_id: user, payment_intent: `pi_${id}` });

test("billing off: credits routes and webhooks answer 503", async () => {
  env = testEnv(db);
  const req = api();
  expect((await req("/credits")).status).toBe(503);
  expect((await req("/webhooks/stripe", { method: "POST", body: "{}" })).status).toBe(503);
  expect((await req("/webhooks/revenuecat", post({}))).status).toBe(503);
});

test("stripe webhook: bad signature 400, unknown types 200", async () => {
  const req = api();
  expect((await req("/webhooks/stripe", { method: "POST", headers: { "stripe-signature": "t=1,v1=bad" }, body: "{}" })).status).toBe(400);
  expect((await req("/webhooks/stripe", event("customer.created", { id: "cus_9" }))).status).toBe(200);
});

test("invoice.paid grants the plan once, even for duplicate and repeated events", async () => {
  const req = api();
  const e = event("invoice.paid", invoice("in_1"));
  expect((await req("/webhooks/stripe", e)).status).toBe(200);
  expect((await req("/webhooks/stripe", e)).status).toBe(200); // same event id
  expect((await req("/webhooks/stripe", event("invoice.paid", invoice("in_1")))).status).toBe(200); // new event, same invoice
  await req("/webhooks/stripe", event("invoice.paid", invoice("in_x", "manual")));
  expect(kinds()).toEqual([{ kind: "plan_grant", d: 1000 }]);
  const b = balance(db, "u");
  expect(b.plan).toBe(1000);
  expect(Date.parse(b.planExpiresAt!)).toBe((future + 86400) * 1000);
});

test("pack via webhook and via fulfill grants once", async () => {
  const req = api();
  stripe.sessions.cs_p = packSession("cs_p");
  await req("/webhooks/stripe", event("checkout.session.completed", stripe.sessions.cs_p));
  const res = await req("/billing/fulfill", post({ sessionId: "cs_p" }));
  expect(await res.json()).toEqual({ status: "paid", item: "pack_s", credited: 500, balance: 500 });
  await req("/webhooks/stripe", event("checkout.session.async_payment_succeeded", stripe.sessions.cs_p));
  expect(kinds()).toEqual([{ kind: "pack", d: 500 }]);
  expect((await req("/billing/fulfill", post({ sessionId: "cs_p" }, "v"))).status).toBe(404);
  expect((await req("/billing/fulfill", post({ sessionId: "cs_nope" }))).status).toBe(404);
});

test("fulfill: processing, unpaid and expired sessions grant nothing", async () => {
  const req = api();
  stripe.sessions.a = { ...packSession("a"), payment_status: "unpaid" };
  stripe.sessions.b = { ...packSession("b"), status: "open", payment_status: "unpaid" };
  stripe.sessions.c = { ...packSession("c"), status: "expired", payment_status: "unpaid" };
  const st = async (id: string) => (await (await req("/billing/fulfill", post({ sessionId: id }))).json()).status;
  expect([await st("a"), await st("b"), await st("c")]).toEqual(["processing", "unpaid", "expired"]);
  expect(kinds()).toEqual([]);
});

test("subscription checkout: fulfill grants from the paid invoice, the webhook does not grant again", async () => {
  const req = api();
  stripe.subs.sub_1 = sub("sub_1", "active");
  stripe.invs.in_1 = invoice("in_1");
  stripe.sessions.cs_s = { id: "cs_s", mode: "subscription", status: "complete", payment_status: "paid", metadata: { user_id: "u", item: "plan" }, subscription: "sub_1", invoice: "in_1" };
  expect(await (await req("/billing/fulfill", post({ sessionId: "cs_s" }))).json()).toEqual({ status: "paid", item: "plan", credited: 1000, balance: 1000 });
  await req("/webhooks/stripe", event("checkout.session.completed", stripe.sessions.cs_s));
  await req("/webhooks/stripe", event("invoice.paid", invoice("in_1")));
  expect(kinds()).toEqual([{ kind: "plan_grant", d: 1000 }]);
  expect((await (await req("/credits")).json()).subscription).toEqual({ provider: "stripe", status: "active", periodEnd: new Date(future * 1000).toISOString(), cancelAtPeriodEnd: false });
});

test("subscription events in any order store Stripe's current state", async () => {
  const req = api();
  stripe.subs.sub_1 = sub("sub_1", "canceled");
  await req("/webhooks/stripe", event("customer.subscription.deleted", sub("sub_1", "canceled")));
  await req("/webhooks/stripe", event("customer.subscription.created", sub("sub_1", "active"))); // late
  await req("/webhooks/stripe", event("customer.subscription.updated", sub("sub_1", "past_due"))); // stale
  expect((await (await req("/credits")).json()).subscription.status).toBe("canceled");
  stripe.subs.sub_1 = { ...sub("sub_1", "active"), cancel_at_period_end: true };
  await req("/webhooks/stripe", event("customer.subscription.updated", sub("sub_1", "active")));
  expect((await (await req("/credits")).json()).subscription).toMatchObject({ status: "active", cancelAtPeriodEnd: true });
});

test("stripe events for a deleted user write nothing", async () => {
  const req = api();
  stripe.subs.sub_1 = sub("sub_1", "canceled", "gone");
  await req("/webhooks/stripe", event("customer.subscription.deleted", sub("sub_1", "canceled", "gone")));
  stripe.sessions.cs_9 = packSession("cs_9", "gone");
  await req("/webhooks/stripe", event("checkout.session.completed", packSession("cs_9", "gone")));
  expect(db.tx((q) => q.all("SELECT 1 FROM subscriptions"))).toEqual([]);
  expect(kinds()).toEqual([]);
});

test("charge.refunded takes back the refunded share of a pack, rounded down; plan charges are ignored", async () => {
  const req = api();
  stripe.sessions.cs_p = packSession("cs_p");
  await req("/billing/fulfill", post({ sessionId: "cs_p" }));
  const charge = { id: "ch_1", object: "charge", payment_intent: "pi_cs_p", amount: 599 };
  await req("/webhooks/stripe", event("charge.refunded", { ...charge, amount_refunded: 300 }));
  expect(balance(db, "u").topup).toBe(250);
  const full = event("charge.refunded", { ...charge, amount_refunded: 599 });
  await req("/webhooks/stripe", full);
  await req("/webhooks/stripe", full);
  await req("/webhooks/stripe", event("charge.refunded", { id: "ch_2", payment_intent: "pi_plan", amount: 1199, amount_refunded: 1199 }));
  expect(kinds()).toEqual([{ kind: "pack", d: 500 }, { kind: "stripe_refund", d: -250 }, { kind: "stripe_refund", d: -250 }]);
  expect(balance(db, "u").total).toBe(0);
});

test("checkout: tax, lookup-key price, URLs, customer reuse, already_subscribed", async () => {
  const req = api();
  expect((await req("/billing/checkout", post({ item: "gold" }))).status).toBe(400);
  const res = await req("/billing/checkout", post({ item: "plan" }));
  expect(await res.json()).toEqual({ url: "https://checkout.stripe.test/cs_new" });
  const p = stripe.checkout.sessions.create.mock.calls[0][0];
  expect(p).toMatchObject({
    mode: "subscription", customer: "cus_1", client_reference_id: "u", metadata: { user_id: "u", item: "plan" },
    line_items: [{ price: "price_questie_plan_monthly_1199", quantity: 1 }],
    automatic_tax: { enabled: true }, tax_id_collection: { enabled: true }, billing_address_collection: "required",
    success_url: "http://localhost/?session_id={CHECKOUT_SESSION_ID}#/billing/done", cancel_url: "http://localhost/#/plans?canceled=1",
    subscription_data: { metadata: { user_id: "u" } },
  });
  await req("/billing/checkout", post({ item: "pack_l" }));
  expect(stripe.checkout.sessions.create.mock.calls[1][0]).toMatchObject({
    mode: "payment", invoice_creation: { enabled: true }, line_items: [{ price: "price_questie_pack_1500_1499" }], automatic_tax: { enabled: true },
  });
  expect(stripe.customers.create).toHaveBeenCalledTimes(1);
  db.tx((q) => q.run("INSERT INTO subscriptions VALUES ('revenuecat', 't1', 'u', 'app_store', 'active', NULL, 0, '')"));
  const dup = await req("/billing/checkout", post({ item: "plan" }));
  expect(dup.status).toBe(409);
  expect((await dup.json()).code).toBe("already_subscribed");
  expect((await req("/billing/checkout", post({ item: "pack_s" }))).status).toBe(200); // subscribers can buy packs
});

test("portal: 404 without a customer, else the portal URL", async () => {
  const req = api();
  expect((await req("/billing/portal", post({}))).status).toBe(404);
  await req("/billing/checkout", post({ item: "pack_s" }));
  expect(await (await req("/billing/portal", post({}))).json()).toEqual({ url: "https://billing.stripe.test/p" });
  expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({ customer: "cus_1", return_url: "http://localhost/#/profile" });
});

const rc = (ev: object, auth = "Bearer rc") => ({ method: "POST", headers: { "Content-Type": "application/json", Authorization: auth }, body: JSON.stringify({ api_version: "1.0", event: ev }) });
const rcEv = (type: string, product: string, extra: object = {}) => ({
  id: `rc_${++n}`, type, app_user_id: "u", product_id: product, store: "APP_STORE", original_transaction_id: "otx_1", transaction_id: `tx_${n}`,
  expiration_at_ms: future * 1000, ...extra,
});

test("revenuecat: bad auth 401, unknown user 200 and ignored", async () => {
  const req = api();
  expect((await req("/webhooks/revenuecat", rc(rcEv("INITIAL_PURCHASE", "questie.plan.monthly"), "Bearer nope"))).status).toBe(401);
  expect((await req("/webhooks/revenuecat", rc(rcEv("INITIAL_PURCHASE", "questie.plan.monthly", { app_user_id: "$RCAnonymousID:1" })))).status).toBe(200);
  expect(kinds()).toEqual([]);
});

test("revenuecat: plan, duplicate event, pack, store refund, status changes", async () => {
  const req = api();
  const buy = rc(rcEv("INITIAL_PURCHASE", "questie.plan.monthly:monthly"));
  await req("/webhooks/revenuecat", buy);
  await req("/webhooks/revenuecat", buy);
  expect(balance(db, "u").plan).toBe(1000);
  expect((await (await req("/credits")).json()).subscription).toMatchObject({ provider: "revenuecat", store: "app_store", status: "active" });
  await req("/webhooks/revenuecat", rc(rcEv("NON_RENEWING_PURCHASE", "questie.credits.500")));
  await req("/webhooks/revenuecat", rc(rcEv("CANCELLATION", "questie.credits.500", { cancel_reason: "CUSTOMER_SUPPORT" })));
  await req("/webhooks/revenuecat", rc(rcEv("CANCELLATION", "questie.plan.monthly")));
  expect((await (await req("/credits")).json()).subscription).toMatchObject({ status: "active", cancelAtPeriodEnd: true });
  await req("/webhooks/revenuecat", rc(rcEv("EXPIRATION", "questie.plan.monthly")));
  expect((await (await req("/credits")).json()).subscription.status).toBe("expired");
  await req("/webhooks/revenuecat", rc(rcEv("RENEWAL", "questie.plan.monthly")));
  expect(kinds().map((k) => k.kind)).toEqual(["plan_grant", "pack", "store_refund", "plan_expire", "plan_grant"]);
  expect(balance(db, "u")).toMatchObject({ plan: 1000, topup: 0 });
});

test("ledger: newest first, cursor pages, labels from refs", async () => {
  const req = api();
  db.tx((q) => {
    q.run("INSERT INTO jobs (id, user_id, kind, status, title, input, created_at) VALUES ('job1', 'u', 'build', 'done', 'Rust ownership', '{}', '')");
    const row = (id: string, at: string, kind: string, d: number, action: string | null, ref: string | null) =>
      q.run("INSERT INTO credit_ledger (id, user_id, kind, topup_delta, action, source, source_id, ref, created_at) VALUES (?, 'u', ?, ?, ?, 'x', ?, ?, ?)", id, kind, d, action, id, ref, at);
    row("a", "2026-11-01T00:00:00.000Z", "pack", 500, null, null);
    row("b", "2026-11-02T00:00:00.000Z", "spend", -100, "course_topic", "job1");
    row("c", "2026-11-03T00:00:00.000Z", "spend", -2, "grade", "t:w");
  });
  const p1 = await (await req("/credits/ledger?limit=2")).json();
  expect(p1.rows.map((r: { id: string }) => r.id)).toEqual(["c", "b"]);
  expect(p1.rows[1]).toEqual({ id: "b", kind: "spend", delta: -100, action: "course_topic", ref: "job1", label: "Rust ownership", createdAt: "2026-11-02T00:00:00.000Z" });
  const p2 = await (await req(`/credits/ledger?limit=2&before=${encodeURIComponent(p1.next)}`)).json();
  expect(p2).toEqual({ rows: [expect.objectContaining({ id: "a", delta: 500 })], next: null });
  expect((await (await req("/credits/ledger", { headers: { "x-test-user": "v" } })).json()).rows).toEqual([]);
});

test("admin credits: admins only, by email, idempotent per key", async () => {
  const req = api({ session: async (c) => ({ ...account(c.req.header("x-test-user") ?? "u"), email: c.req.header("x-test-user") === "admin" ? "admin@x.com" : "u@x.com" }) });
  const body = { email: "V@x.com", amount: 50, note: "support" };
  expect((await req("/admin/credits", post(body))).status).toBe(403);
  const init = post(body, "admin");
  (init.headers as Record<string, string>)["Idempotency-Key"] = "k1";
  expect(await (await req("/admin/credits", init)).json()).toEqual({ balance: 50 });
  expect(await (await req("/admin/credits", init)).json()).toEqual({ balance: 50 });
  expect((await req("/admin/credits", post({ ...body, email: "nobody@x.com" }, "admin"))).status).toBe(404);
  expect((await req("/admin/credits", post({ ...body, amount: 1.5 }, "admin"))).status).toBe(400);
});

test("cancelForUser cancels the user's live Stripe subscriptions", async () => {
  await cancelForUser(db, env, { stripe: () => stripe } as unknown as Deps, "u"); // no customer: nothing to do
  expect(stripe.subscriptions.list).not.toHaveBeenCalled();
  db.tx((q) => q.run("INSERT INTO billing_customers VALUES ('u', 'cus_1', '')"));
  stripe.subs.a = sub("a", "active");
  stripe.subs.b = sub("b", "canceled");
  await cancelForUser(db, env, { stripe: () => stripe } as unknown as Deps, "u");
  expect(stripe.subscriptions.cancel.mock.calls.map((c) => c[0])).toEqual(["a"]);
});
