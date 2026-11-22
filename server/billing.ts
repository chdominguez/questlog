import { Hono, type Context } from "hono";
import { createHash, timingSafeEqual } from "node:crypto";
import type Stripe from "stripe";
import type { CheckoutItem, FulfillResult, LedgerPage, LedgerRow } from "../shared/api-types";
import { PACKS, PLAN } from "../shared/pricing";
import type { Course } from "../src/course/registry";
import { str, type App, type Deps, type SessionUser } from "./api";
import { requireAdmin } from "./admin";
import { balance, credits, grant, grantTx, metered, subscribed } from "./credits";
import type { Db, Tx } from "./db";
import type { Env } from "./env";
import { err } from "./errors";

const ITEMS = { plan: PLAN, ...PACKS } as const;
const isItem = (v: unknown): v is CheckoutItem => typeof v === "string" && Object.hasOwn(ITEMS, v);
const iso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null);
const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : v?.id ?? null);
const off = (c: Context) => err(c, 503, "not_configured");

type SubState = { provider: "stripe" | "revenuecat"; externalId: string; user: string; store?: string | null; status: string; periodEnd: string | null; cancel: boolean };
function upsertSub(q: Tx, s: SubState) {
  q.run(
    `INSERT INTO subscriptions (provider, external_id, user_id, store, status, period_end, cancel_at_period_end, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (provider, external_id) DO UPDATE SET user_id = excluded.user_id, store = coalesce(excluded.store, store), status = excluded.status,
       period_end = coalesce(excluded.period_end, period_end), cancel_at_period_end = excluded.cancel_at_period_end, updated_at = excluded.updated_at`,
    s.provider, s.externalId, s.user, s.store ?? null, s.status, s.periodEnd, s.cancel ? 1 : 0, new Date().toISOString(),
  );
}

// ---- Stripe ----

const STATUS: Record<string, string> = { active: "active", trialing: "active", past_due: "past_due", unpaid: "past_due", canceled: "canceled" };

/** The user behind a Stripe customer: billing_customers first, else the user_id we put in metadata. */
const userOf = (q: Tx, customer: string | { id: string } | null, meta?: Record<string, string> | null) =>
  q.get<{ user_id: string }>("SELECT user_id FROM billing_customers WHERE stripe_customer_id = ?", idOf(customer))?.user_id ?? meta?.user_id ?? null;

function stripeSub(q: Tx, sub: Stripe.Subscription, user: string) {
  upsertSub(q, {
    provider: "stripe", externalId: sub.id, user, status: STATUS[sub.status] ?? "expired",
    periodEnd: iso(Math.max(0, ...sub.items.data.map((i) => i.current_period_end))), cancel: sub.cancel_at_period_end || !!sub.cancel_at,
  });
}

/** Plan grant for a paid subscription invoice; plan credits last until the line's period end + grace. */
function planFromInvoice(q: Tx, user: string, inv: Stripe.Invoice) {
  const end = iso(Math.max(0, ...inv.lines.data.map((l) => l.period.end)));
  grantTx(q, { user, kind: "plan_grant", plan: PLAN.credits, source: "stripe_invoice", sourceId: inv.id!, periodEnd: end ?? undefined });
}

/**
 * What a checkout session grants (shared by POST /billing/fulfill and the webhook). Stripe reads happen here;
 * apply() is the sync write for one tx and returns the credits this session added.
 */
async function fulfillment(stripe: Stripe, s: Stripe.Checkout.Session) {
  const user = s.metadata?.user_id ?? s.client_reference_id ?? "";
  const item = (isItem(s.metadata?.item) ? s.metadata.item : s.mode === "subscription" ? "plan" : "pack_s") as CheckoutItem;
  const paid = s.payment_status === "paid" || s.payment_status === "no_payment_required";
  const status: FulfillResult["status"] = s.status === "expired" ? "expired" : paid ? "paid" : s.status === "complete" ? "processing" : "unpaid";
  let apply = (_q: Tx) => 0;
  if (paid && s.mode === "payment" && item !== "plan") {
    apply = (q) => {
      grantTx(q, { user, kind: "pack", topup: ITEMS[item].credits, source: "stripe_checkout", sourceId: s.id, ref: idOf(s.payment_intent) ?? undefined });
      return ITEMS[item].credits;
    };
  } else if (paid && s.mode === "subscription") {
    const [sub, inv] = await Promise.all([
      idOf(s.subscription) ? stripe.subscriptions.retrieve(idOf(s.subscription)!) : null,
      idOf(s.invoice) ? stripe.invoices.retrieve(idOf(s.invoice)!) : null,
    ]);
    apply = (q) => {
      if (sub) stripeSub(q, sub, user);
      if (inv?.status !== "paid") return 0;
      planFromInvoice(q, user, inv);
      return PLAN.credits;
    };
  }
  return { user, item, status, apply };
}

/** Async Stripe reads for one event, then the sync writes to run in the dedupe tx (null = ignored type). */
async function stripeEvent(stripe: Stripe, ev: Stripe.Event): Promise<((q: Tx) => void) | null> {
  switch (ev.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const f = await fulfillment(stripe, ev.data.object);
      return (q) => { if (f.user) f.apply(q); };
    }
    case "invoice.paid": {
      const inv = ev.data.object;
      if (inv.billing_reason !== "subscription_create" && inv.billing_reason !== "subscription_cycle") return null;
      return (q) => {
        const user = userOf(q, inv.customer, inv.parent?.subscription_details?.metadata);
        if (user) planFromInvoice(q, user, inv); else console.warn(`stripe: no user for invoice ${inv.id}`);
      };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      // Re-read: events arrive in any order, the current state is what counts.
      const sub = await stripe.subscriptions.retrieve(ev.data.object.id).catch(() => ev.data.object);
      return (q) => {
        const user = userOf(q, sub.customer, sub.metadata);
        if (user) stripeSub(q, sub, user); else console.warn(`stripe: no user for subscription ${sub.id}`);
      };
    }
    case "charge.refunded":
      return (q) => packRefund(q, ev.data.object);
  }
  return null;
}

/** Takes back the refunded share of a pack, rounded down; partial refunds add up (amount_refunded is cumulative). */
function packRefund(q: Tx, ch: Stripe.Charge) {
  const g = q.get<{ user_id: string; topup_delta: number }>(
    "SELECT user_id, topup_delta FROM credit_ledger WHERE source = 'stripe_checkout' AND ref = ?", idOf(ch.payment_intent));
  if (!g || !ch.amount) return; // not a pack (plan invoices keep their credits)
  const due = Math.floor((g.topup_delta * ch.amount_refunded) / ch.amount);
  const done = -q.get<{ n: number }>("SELECT coalesce(sum(topup_delta), 0) AS n FROM credit_ledger WHERE kind = 'stripe_refund' AND ref = ?", ch.id)!.n;
  if (due > done) {
    grantTx(q, { user: g.user_id, kind: "stripe_refund", topup: -(due - done), source: "stripe_refund", sourceId: `${ch.id}:${ch.amount_refunded}`, ref: ch.id });
  }
}

const priceIds = new Map<string, string>();
async function priceId(stripe: Stripe, lookupKey: string) {
  let id = priceIds.get(lookupKey);
  if (!id) {
    const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    if (!data[0]) throw new Error(`No Stripe price with lookup key ${lookupKey}; run npm run stripe:setup`);
    priceIds.set(lookupKey, (id = data[0].id));
  }
  return id;
}

const customerId = (db: Db, user: string) =>
  db.tx((q) => q.get<{ id: string }>("SELECT stripe_customer_id AS id FROM billing_customers WHERE user_id = ?", user)?.id ?? null);

async function customerFor(stripe: Stripe, db: Db, a: SessionUser) {
  const known = customerId(db, a.id);
  if (known) return known;
  const cu = await stripe.customers.create({ email: a.email, name: a.name || undefined, metadata: { user_id: a.id } }, { idempotencyKey: `customer-${a.id}` });
  db.tx((q) => q.run("INSERT OR IGNORE INTO billing_customers (user_id, stripe_customer_id, created_at) VALUES (?, ?, ?)", a.id, cu.id, new Date().toISOString()));
  return customerId(db, a.id)!;
}

/** Cancels the user's Stripe plan now (account deletion). Store plans are the user's to cancel in the store. */
export async function cancelForUser(db: Db, env: Env, deps: Deps, user: string): Promise<void> {
  const stripe = metered(env) ? deps.stripe(env) : null;
  const customer = stripe && customerId(db, user);
  if (!stripe || !customer) return;
  const { data } = await stripe.subscriptions.list({ customer, status: "all", limit: 100 });
  for (const s of data) if (s.status !== "canceled" && s.status !== "incomplete_expired") await stripe.subscriptions.cancel(s.id);
}

// ---- RevenueCat ----

type RcEvent = {
  id: string; type: string; app_user_id: string; product_id?: string; store?: string; cancel_reason?: string;
  original_transaction_id?: string; transaction_id?: string; expiration_at_ms?: number | null;
};

const sameSecret = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

function rcApply(q: Tx, ev: RcEvent) {
  const user = ev.app_user_id;
  const plan = (PLAN.rcProducts as readonly string[]).includes(ev.product_id ?? "");
  const pack = Object.values(PACKS).find((p) => (p.rcProducts as readonly string[]).includes(ev.product_id ?? ""));
  const store = ev.store === "APP_STORE" || ev.store === "MAC_APP_STORE" ? "app_store" : ev.store === "PLAY_STORE" ? "play_store" : null;
  const periodEnd = ev.expiration_at_ms ? new Date(ev.expiration_at_ms).toISOString() : null;
  const sub = (status: string, cancel = false) => upsertSub(q, {
    provider: "revenuecat", externalId: ev.original_transaction_id ?? ev.transaction_id ?? user, user, store, status, periodEnd, cancel,
  });
  const ref = ev.transaction_id;
  if (plan) {
    if (ev.type === "INITIAL_PURCHASE" || ev.type === "RENEWAL") {
      grantTx(q, { user, kind: "plan_grant", plan: PLAN.credits, source: "rc", sourceId: ev.id, ref, periodEnd: periodEnd ?? undefined });
      sub("active");
    } else if (ev.type === "UNCANCELLATION") sub("active");
    else if (ev.type === "CANCELLATION") sub(ev.cancel_reason === "CUSTOMER_SUPPORT" ? "canceled" : "active", true);
    else if (ev.type === "EXPIRATION") sub("expired");
    else if (ev.type === "BILLING_ISSUE") sub("past_due");
  } else if (pack) {
    if (ev.type === "NON_RENEWING_PURCHASE") grantTx(q, { user, kind: "pack", topup: pack.credits, source: "rc", sourceId: ev.id, ref });
    else if (ev.type === "CANCELLATION") grantTx(q, { user, kind: "store_refund", topup: -pack.credits, source: "rc", sourceId: ev.id, ref });
  }
}

// ---- Ledger labels ----

/** Course or level title for a ledger ref: a job id, a mock id, a course id or "<course>:<level>". */
function labelOf(q: Tx, courses: Course[], ref: string | null): string | null {
  if (!ref) return null;
  const job = q.get<{ title: string | null }>("SELECT title FROM jobs WHERE id = ?", ref);
  if (job) return job.title;
  const id = q.get<{ course_id: string }>("SELECT course_id FROM mock_sessions WHERE id = ?", ref)?.course_id ?? ref;
  const i = id.indexOf(":");
  const cid = i < 0 ? id : id.slice(0, i);
  const fixed = courses.find((c) => c.id === cid);
  if (fixed) return i < 0 ? fixed.title : fixed.levels.find((l) => l.id === id)?.title ?? fixed.title;
  const uc = q.get<{ title: string; json: string }>("SELECT title, json FROM user_courses WHERE id = ?", cid);
  if (!uc) return null;
  if (i < 0) return uc.title;
  try {
    const lv = (JSON.parse(uc.json).levels ?? []) as { id: string; title: string }[];
    return lv.find((l) => l.id === id.slice(i + 1) || l.id === id)?.title ?? uc.title;
  } catch { return uc.title; }
}

// ---- Routes ----

const body = async (c: Context<App>) => ((await c.req.json().catch(() => undefined)) ?? {}) as Record<string, unknown>;

/** Public: /webhooks/*. */
export function billingPublic(deps: Deps): Hono<App> {
  return new Hono<App>()
    .post("/webhooks/stripe", async (c) => {
      const stripe = metered(c.env) ? deps.stripe(c.env) : null;
      if (!stripe) return off(c);
      const raw = await c.req.text();
      let ev: Stripe.Event;
      try { ev = stripe.webhooks.constructEvent(raw, c.req.header("stripe-signature") ?? "", c.env.STRIPE_WEBHOOK_SECRET!); }
      catch { return err(c, 400, "invalid_request", {}, "Bad signature"); }
      const apply = await stripeEvent(stripe, ev);
      c.env.DB.tx((q) => {
        if (!q.run("INSERT OR IGNORE INTO webhook_events (provider, event_id, type, received_at) VALUES ('stripe', ?, ?, ?)", ev.id, ev.type, new Date().toISOString())) return;
        apply?.(q);
      });
      return c.json({ received: true });
    })
    .post("/webhooks/revenuecat", async (c) => {
      if (!metered(c.env)) return off(c);
      const want = c.env.REVENUECAT_WEBHOOK_AUTH;
      if (!want || !sameSecret(c.req.header("authorization") ?? "", want)) return err(c, 401, "unauthorized");
      const ev = (await body(c)).event as RcEvent | undefined;
      if (!ev || typeof ev.id !== "string" || typeof ev.type !== "string" || typeof ev.app_user_id !== "string") return err(c, 400, "invalid_request");
      c.env.DB.tx((q) => {
        // RevenueCat retries are pointless for an unknown user: log and answer 200.
        if (!q.get('SELECT 1 FROM "user" WHERE id = ?', ev.app_user_id)) return console.warn(`revenuecat: unknown user ${ev.app_user_id} (${ev.type} ${ev.id})`);
        if (!q.run("INSERT OR IGNORE INTO webhook_events (provider, event_id, type, received_at) VALUES ('revenuecat', ?, ?, ?)", ev.id, ev.type, new Date().toISOString())) return;
        rcApply(q, ev);
      });
      return c.json({ received: true });
    });
}

/** Private: /credits*, /billing/*, /admin/credits. */
export function billingRoutes(deps: Deps): Hono<App> {
  const stripeOf = (c: Context<App>) => (metered(c.env) ? deps.stripe(c.env) : null);
  return new Hono<App>()
    .get("/credits", (c) => {
      const cr = credits(c.env.DB, c.env, c.get("user"));
      return cr ? c.json(cr) : off(c);
    })
    .get("/credits/ledger", (c) => {
      if (!metered(c.env)) return off(c);
      const limit = Math.min(100, Math.max(1, Number(c.req.query("limit")) || 50));
      const [at, id] = (c.req.query("before") ?? "").split("|");
      const page = c.env.DB.tx((q) => {
        const rows = q.all<{ id: string; kind: LedgerRow["kind"]; plan_delta: number; topup_delta: number; action: LedgerRow["action"]; ref: string | null; created_at: string }>(
          `SELECT id, kind, plan_delta, topup_delta, action, ref, created_at FROM credit_ledger
           WHERE user_id = ? AND (? = '' OR (created_at, id) < (?, ?)) ORDER BY created_at DESC, id DESC LIMIT ?`,
          c.get("user"), at && id ? at : "", at ?? "", id ?? "", limit);
        return rows.map((r): LedgerRow => ({
          id: r.id, kind: r.kind, delta: r.plan_delta + r.topup_delta, action: r.action, ref: r.ref,
          label: r.action && r.action !== "grade" && r.action !== "improve" ? labelOf(q, deps.courses, r.ref) : null, createdAt: r.created_at,
        }));
      });
      const last = page.length === limit ? page[page.length - 1] : null;
      return c.json({ rows: page, next: last && `${last.createdAt}|${last.id}` } satisfies LedgerPage);
    })
    .post("/billing/checkout", async (c) => {
      const stripe = stripeOf(c);
      if (!stripe) return off(c);
      const { item } = await body(c);
      if (!isItem(item)) return err(c, 400, "invalid_request", {}, "Invalid item");
      const db = c.env.DB, user = c.get("user"), app = c.env.APP_URL;
      if (item === "plan" && db.tx((q) => subscribed(q, user))) return err(c, 409, "already_subscribed");
      const customer = await customerFor(stripe, db, c.get("account"));
      const base = {
        customer, client_reference_id: user, metadata: { user_id: user, item },
        line_items: [{ price: await priceId(stripe, ITEMS[item].lookupKey), quantity: 1 }],
        automatic_tax: { enabled: true }, customer_update: { address: "auto", name: "auto" }, tax_id_collection: { enabled: true },
        billing_address_collection: "required",
        success_url: `${app}/?session_id={CHECKOUT_SESSION_ID}#/billing/done`, cancel_url: `${app}/#/plans?canceled=1`,
      } satisfies Stripe.Checkout.SessionCreateParams;
      const s = await stripe.checkout.sessions.create(item === "plan"
        ? { ...base, mode: "subscription", subscription_data: { metadata: { user_id: user } } }
        : { ...base, mode: "payment", invoice_creation: { enabled: true }, payment_intent_data: { metadata: { user_id: user, item } } });
      return c.json({ url: s.url });
    })
    .post("/billing/portal", async (c) => {
      const stripe = stripeOf(c);
      if (!stripe) return off(c);
      const customer = customerId(c.env.DB, c.get("user"));
      if (!customer) return err(c, 404, "not_found");
      const s = await stripe.billingPortal.sessions.create({ customer, return_url: `${c.env.APP_URL}/#/profile` });
      return c.json({ url: s.url });
    })
    .post("/billing/fulfill", async (c) => {
      const stripe = stripeOf(c);
      if (!stripe) return off(c);
      const { sessionId } = await body(c);
      if (!str(sessionId, 200, 1)) return err(c, 400, "invalid_request", {}, "Invalid sessionId");
      const s = await stripe.checkout.sessions.retrieve(sessionId).catch(() => null);
      const user = c.get("user");
      if (!s || (s.metadata?.user_id ?? s.client_reference_id) !== user) return err(c, 404, "not_found");
      const f = await fulfillment(stripe, s);
      const credited = c.env.DB.tx((q) => f.apply(q));
      return c.json({ status: f.status, item: f.item, credited, balance: balance(c.env.DB, user).total } satisfies FulfillResult);
    })
    .post("/admin/credits", requireAdmin, async (c) => {
      if (!metered(c.env)) return off(c);
      const b = await body(c);
      const email = b.email;
      if (!str(email, 320, 3)) return err(c, 400, "invalid_request", {}, "Invalid email");
      if (!Number.isSafeInteger(b.amount) || b.amount === 0 || Math.abs(b.amount as number) > 1_000_000) return err(c, 400, "invalid_request", {}, "Invalid amount");
      if (b.note !== undefined && !str(b.note, 500)) return err(c, 400, "invalid_request", {}, "Invalid note");
      const db = c.env.DB;
      const target = db.tx((q) => q.get<{ id: string }>('SELECT id FROM "user" WHERE lower(email) = lower(?)', email.trim()))?.id;
      if (!target) return err(c, 404, "not_found", {}, "Unknown user");
      const key = c.req.header("idempotency-key")?.slice(0, 200) || crypto.randomUUID();
      grant(db, { user: target, kind: "adjust", topup: b.amount as number, source: "admin", sourceId: `${c.get("user")}:${key}`, note: (b.note as string | undefined) ?? undefined });
      return c.json({ balance: balance(db, target).total });
    });
}
