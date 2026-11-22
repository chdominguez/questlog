// E2E server: the real app and API with fakes for Anthropic, Stripe, ElevenLabs, Resend and FCM. Run by playwright.config.ts.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import type Anthropic from "@anthropic-ai/sdk";
import { Hono } from "hono";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Stripe from "stripe";
import type { Grade } from "../shared/api-types";
import { createApi, defaultDeps, type Deps } from "./api";
import { createAuth, sessionFrom } from "./auth";
import { openDb } from "./db";
import { readEnv, type Env } from "./env";
import { startJobs } from "./jobs";
import { cspHeader } from "./media";

const PORT = Number(process.env.E2E_PORT ?? 8799);
const APP_URL = `http://127.0.0.1:${PORT}`;
const WEBHOOK_SECRET = "whsec_e2e";
const dir = mkdtempSync(join(tmpdir(), "questie-e2e-"));
const config = readEnv({
  APP_URL, BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e", DB_PATH: join(dir, "e2e.db"), MEDIA_DIR: join(dir, "media"),
  PORT: String(PORT), RESEND_API_KEY: "re_e2e", ADMIN_EMAILS: "admin@e2e.test", ANTHROPIC_API_KEY: "sk-ant-e2e",
  ELEVENLABS_API_KEY: "el_e2e", ELEVENLABS_VOICES: "voice1", STRIPE_SECRET_KEY: "sk_test_e2e", STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  REVENUECAT_WEBHOOK_AUTH: "Bearer rc_e2e",
});
const db = openDb(config.DB_PATH);
const env: Env = { ...config, DB: db };

// ---- Resend, ElevenLabs, FCM: one fetch ----

const mails: { to: string; subject: string; text: string }[] = [];
const mp3 = readFileSync("e2e/fixtures/silence.mp3");
const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url === "https://api.resend.com/emails") {
    const b = JSON.parse(String(init?.body)) as { to: string[]; subject: string; text: string };
    mails.push({ to: b.to[0], subject: b.subject, text: b.text });
    return Response.json({ id: `mail_${mails.length}` });
  }
  if (url.startsWith("https://api.elevenlabs.io/")) return new Response(mp3, { headers: { "Content-Type": "audio/mpeg" } });
  if (url.startsWith("https://oauth2.googleapis.com/") || url.startsWith("https://fcm.googleapis.com/")) return Response.json({});
  throw new Error(`e2e: unexpected fetch ${url}`);
}) as typeof fetch;

// ---- Anthropic: scripted course builder output that passes validateCourse ----

const msg = (text: string) => ({ content: [{ type: "text", text, citations: null }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 10 } });
const fenced = (v: unknown) => msg("```json\n" + JSON.stringify(v) + "\n```");
const card = (title: string, text: string) => ({ title, blocks: [{ kind: "md", text }] });
const LEVELS = [
  {
    id: "basics", title: "Basics",
    theory: [card("What it is", "A **list** holds values in order."), card("Indexes", "The first item has index `0`.")],
    challenges: [
      { id: "first-index", type: "quiz", prompt: "What is the index of the first item?", options: ["0", "1"], answer: 0 },
      { id: "order-word", type: "flashcard", prompt: "A list keeps its items in…", back: "order" },
    ],
  },
  {
    id: "boss", title: "Boss",
    theory: [card("Why order matters", "Order lets you read items by position.")],
    challenges: [
      { id: "explain", type: "written", prompt: "Why does a list keep order?", model: "So items can be read by their position.", keyPoints: ["position", "index"] },
      { id: "last-index", type: "quiz", prompt: "Index of the last of 3 items?", options: ["2", "3"], answer: 0 },
    ],
  },
];
let builds = 0;
const anthropic = {
  files: { upload: async () => ({ id: `file_e2e_${++builds}` }), delete: async () => ({}) },
  messages: { create: async () => msg(JSON.stringify({ ok: true, suggestions: [] })) },
  beta: { messages: { stream: (p: { messages: { content: string | { type: string; text?: string }[] }[] }) => {
    const m = p.messages[0].content;
    const last = typeof m === "string" ? m : m[m.length - 1].text ?? "";
    const n = /Write level (\d+)/.exec(last);
    const reply = n ? fenced({ level: LEVELS[Number(n[1]) - 1], katas: [] })
      : /Plan a course/.test(last) ? msg(JSON.stringify({
        reject: "", slug: "lists", title: builds ? "Lists from your notes" : "Lists in practice", summary: "Ordered values",
        levels: LEVELS.map((l) => ({ id: l.id, title: l.title, goals: ["g"], challengeTypes: l.challenges.map((c) => c.type), kataIds: [] })), katas: [],
      }))
      : msg("Brief: lists hold values in order.");
    return { finalMessage: async () => reply };
  } } },
} as unknown as Anthropic;

const grader: Deps["grader"] = () => async (i) => (i.answer.length > 40
  ? { score: 9, covered: ["position", "index"], missing: [], mistakes: [] }
  : { score: 4, covered: ["position"], missing: ["index"], mistakes: ["Too short"] }) satisfies Grade;
const improver: Deps["improver"] = () => async () => ({ improved: "A list keeps order so each item has an index and can be read by position.", corrections: [{ quote: "order", fix: "keeps insertion order" }] });

// ---- Stripe: checkout page on this server, signed webhooks into the API ----

const real = new Stripe("sk_test_e2e");
const sessions = new Map<string, Record<string, unknown>>(), subs = new Map<string, object>(), invoices = new Map<string, object>();
let ids = 0;
const nextId = (p: string) => `${p}_e2e${++ids}`;
const stripe = {
  webhooks: real.webhooks,
  customers: { create: async () => ({ id: nextId("cus") }) },
  prices: { list: async ({ lookup_keys }: { lookup_keys: string[] }) => ({ data: [{ id: `price_${lookup_keys[0]}` }] }) },
  checkout: { sessions: {
    create: async (p: Record<string, unknown>) => {
      const id = nextId("cs_test");
      sessions.set(id, { ...p, id, object: "checkout.session", status: "open", payment_status: "unpaid" });
      return { id, url: `${APP_URL}/__e2e/checkout/${id}` };
    },
    retrieve: async (id: string) => { const s = sessions.get(id); if (!s) throw new Error("No such session"); return s; },
  } },
  billingPortal: { sessions: { create: async () => ({ url: `${APP_URL}/#/profile` }) } },
  subscriptions: {
    retrieve: async (id: string) => subs.get(id),
    list: async () => ({ data: [...subs.values()] }),
    cancel: async (id: string) => ({ id, status: "canceled" }),
  },
  invoices: { retrieve: async (id: string) => invoices.get(id) },
} as unknown as Stripe;

const deps = defaultDeps({ fetch: fakeFetch, anthropic: () => anthropic, stripe: () => stripe, grader, improver });
deps.session = sessionFrom(createAuth(env, db.sqlite, deps));
const api = createApi(deps);

async function webhook(type: string, object: object) {
  const payload = JSON.stringify({ id: nextId("evt"), object: "event", type, data: { object } });
  const res = await api.request("/webhooks/stripe", {
    method: "POST", body: payload, headers: { "stripe-signature": real.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }) },
  }, env);
  if (!res.ok) throw new Error(`webhook ${type}: ${res.status}`);
}

/** Pays the session like Stripe test checkout: webhooks first, then the success redirect. */
async function pay(id: string) {
  const s = sessions.get(id)!;
  const meta = s.metadata as { user_id: string };
  const end = Math.floor(Date.now() / 1000) + 30 * 86400;
  Object.assign(s, { status: "complete", payment_status: "paid", payment_intent: nextId("pi") });
  if (s.mode === "subscription") {
    const sub = { id: nextId("sub"), object: "subscription", customer: s.customer, status: "active", cancel_at_period_end: false, cancel_at: null, metadata: meta, items: { data: [{ current_period_end: end }] } };
    const inv = { id: nextId("in"), object: "invoice", customer: s.customer, status: "paid", billing_reason: "subscription_create", parent: { subscription_details: { metadata: meta } }, lines: { data: [{ period: { end } }] } };
    subs.set(sub.id, sub);
    invoices.set(inv.id, inv);
    Object.assign(s, { subscription: sub.id, invoice: inv.id });
    await webhook("checkout.session.completed", s);
    await webhook("invoice.paid", inv);
  } else await webhook("checkout.session.completed", s);
  return String(s.success_url).replace("{CHECKOUT_SESSION_ID}", id);
}

const index = () => readFileSync("dist/index.html", "utf8");
const app = new Hono<{ Bindings: Env }>()
  .route("/api", api)
  .get("/__e2e/mail", (c) => {
    const to = c.req.query("to");
    const m = mails.filter((x) => !to || x.to === to).at(-1);
    return m ? c.json(m) : c.json({ error: "no mail" }, 404);
  })
  .get("/__e2e/checkout/:id", (c) => {
    const s = sessions.get(c.req.param("id"));
    if (!s) return c.text("Not found", 404);
    return c.html(`<!doctype html><title>Test checkout</title><h1>Test checkout</h1><p>${s.mode}</p><form method="post"><button>Pay</button></form>`);
  })
  .post("/__e2e/checkout/:id", async (c) => (sessions.has(c.req.param("id")) ? c.redirect(await pay(c.req.param("id")), 303) : c.text("Not found", 404)))
  .use(cspHeader)
  .use(serveStatic({ root: "dist" }))
  .get("*", (c) => (/\.\w+$/.test(c.req.path) ? c.text("Not found", 404) : c.html(index())));

serve({ fetch: (req) => app.fetch(req, env), port: PORT, hostname: "127.0.0.1" }, () => console.log(`e2e server on ${APP_URL}`));
startJobs(env, deps);
