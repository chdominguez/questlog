import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import type { JobPoll } from "../shared/api-types";
import { COSTS } from "../shared/pricing";
import { createApi, defaultDeps, type Env } from "./api";
import { assemble, parseBuild, problemsByLevel } from "./builder";
import { memoryDb } from "./db";
import { testEnv } from "./env";
import { as, fakeSandbox, json, kata, level, session } from "./fixtures.test-util";
import { enqueue, registerJob, startJobs } from "./jobs";

// A fake ledger in place of WP4's: balance, idempotent spends, refunds written through db.tx (which must join the failure tx).
const ledger = vi.hoisted(() => ({ balance: 1000, spends: new Map<string, { id: string; cost: number; ref: string }>(), refunded: new Set<string>() }));
vi.mock("./credits", async (orig) => ({
  ...(await orig<typeof import("./credits")>()),
  metered: () => true,
  balance: () => ({ plan: 0, topup: ledger.balance, total: ledger.balance, planExpiresAt: null, freeCourses: 0 }),
  spend: (_db: unknown, _env: unknown, a: { user: string; action: keyof typeof COSTS; key: string; ref: string }) => {
    const prev = ledger.spends.get(`${a.user}:${a.key}`);
    if (prev) return { ok: true, spendId: prev.id, free: false, replay: true, balance: ledger.balance };
    const cost = COSTS[a.action];
    if (ledger.balance < cost) return { ok: false, code: "insufficient_credits", cost, balance: ledger.balance };
    ledger.balance -= cost;
    const id = `spend-${ledger.spends.size + 1}`;
    ledger.spends.set(`${a.user}:${a.key}`, { id, cost, ref: a.ref });
    return { ok: true, spendId: id, free: false, replay: false, balance: ledger.balance };
  },
  refund: (db: { tx(fn: (q: { run(sql: string, ...a: unknown[]): number }) => unknown): unknown }, id: string) => {
    if (ledger.refunded.has(id)) return false;
    db.tx((q) => q.run("INSERT INTO kv (user_id, key, value, updated_at) VALUES ('ledger', ?, 'refund', 0)", id));
    ledger.refunded.add(id);
    ledger.balance += [...ledger.spends.values()].find((s) => s.id === id)!.cost;
    return true;
  },
}));

type Msg = { content: unknown[]; stop_reason: string; usage: { input_tokens: number; output_tokens: number; server_tool_use?: object } };
const msg = (content: unknown[], stop_reason = "end_turn"): Msg => ({ content, stop_reason, usage: { input_tokens: 10, output_tokens: 5 } });
const text = (t: string, citations: unknown[] | null = null) => ({ type: "text", text: t, citations });
const fenced = (v: unknown) => text("Here it is.\n```json\n" + JSON.stringify(v) + "\n```");
const outline = (o: object = {}) => text(JSON.stringify({
  reject: "", slug: "sums", title: "Sums", summary: "Add numbers",
  levels: [{ id: "one", title: "One", goals: ["g"], challengeTypes: ["quiz"], kataIds: ["sum"] }, { id: "two", title: "Two", goals: ["g"], challengeTypes: ["quiz"], kataIds: [] }],
  katas: [{ id: "sum", title: "Sum", lang: "ts", difficulty: "easy" }], ...o,
}));

/** Answers each call by what it asks for; `override` can replace any reply. */
function fakeAI(override: (kind: string, n: number, prompt: string) => Msg | undefined = () => undefined, precheckReply = { ok: true, suggestions: [] as string[] }) {
  const calls: { kind: string; params: Record<string, unknown> }[] = [];
  const count: Record<string, number> = {};
  const kindOf = (p: Record<string, unknown>) => {
    const m = (p.messages as { content: string | { type: string; text?: string }[] }[])[0].content;
    const last = typeof m === "string" ? m : m[m.length - 1].text ?? "";
    const kind = p.tools ? "research" : /Your current version/.test(last) ? `fix:${/Write level (\d+)/.exec(last)![1]}` : /Write level (\d+)/.test(last) ? `write:${/Write level (\d+)/.exec(last)![1]}` : "outline";
    return { kind, last };
  };
  const client = {
    files: { upload: vi.fn(async () => ({ id: "file_1" })), delete: vi.fn(async () => ({})) },
    messages: { create: vi.fn(async () => msg([text(JSON.stringify(precheckReply))])) },
    beta: { messages: { stream: (params: Record<string, unknown>) => {
      const { kind, last } = kindOf(params);
      calls.push({ kind, params });
      count[kind] = (count[kind] ?? 0) + 1;
      const reply = override(kind, count[kind], last) ?? (
        kind === "outline" ? msg([outline()])
        : kind === "write:1" || kind === "fix:1" ? msg([fenced({ level: level("one", { kata: "sum" }), katas: [kata("sum")] })])
        : kind.startsWith("write") || kind.startsWith("fix") ? msg([fenced({ level: level("two"), katas: [] })])
        : msg([text("brief")]));
      return { finalMessage: async () => reply };
    } } },
  };
  return { client: client as unknown as Anthropic & typeof client, calls };
}

let env: Env;
let stop = () => {};
let hour = 0;
const t0 = Date.now();
let ai = fakeAI();
beforeEach(() => {
  ledger.balance = 1000; ledger.spends.clear(); ledger.refunded.clear();
  const db = memoryDb();
  env = testEnv(db, { ANTHROPIC_API_KEY: "k" });
  ai = fakeAI();
  vi.spyOn(Date, "now").mockReturnValue(t0 + ++hour * 2 * 3600_000); // a fresh rate-limit window per test
});
afterEach(() => { stop(); vi.restoreAllMocks(); });

const deps = () => ({ session, sandbox: fakeSandbox, anthropic: () => ai.client });
const req = (path: string, init?: RequestInit) => createApi(deps()).request(path, init, env);
const start = () => { stop = startJobs(env, defaultDeps(deps())); };
const build = (body: object, key = crypto.randomUUID(), user = "u") => req("/builder/jobs", as(user, json("POST", body, { "Idempotency-Key": key })));
const topic = { mode: "topic", topic: "Summing lists in TypeScript", level: "beginner", lang: "en" };

async function settle(id: string, user = "u"): Promise<JobPoll> {
  for (let i = 0; i < 200; i++) {
    const p = await (await req(`/jobs/${id}`, as(user))).json() as JobPoll;
    if (p.job.status === "done" || p.job.status === "failed") return p;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("job did not finish");
}

test("topic build: happy path, events in order, course saved private, balance header", async () => {
  start();
  const res = await build(topic);
  expect(res.status).toBe(202);
  expect(res.headers.get("x-credits-balance")).toBe(String(1000 - COSTS.course_topic));
  const { jobId } = await res.json() as { jobId: string };
  expect([...ledger.spends.values()][0].ref).toBe(jobId); // Credits labels the spend with the job's title
  const p = await settle(jobId);
  expect(p.job).toMatchObject({ status: "done", title: "Sums", mode: "topic", error: null });
  const stages = p.events.flatMap((e) => (e.type === "stage" ? [e.data.stage] : []));
  expect([...new Set(stages)]).toEqual(["outline", "write", "validate", "save"]);
  expect(p.events.find((e) => e.type === "outline")?.data).toEqual({ title: "Sums", levels: [{ id: "one", title: "One" }, { id: "two", title: "Two" }] });
  const courseId = p.job.result!.courseId;
  expect(courseId).toMatch(/^u[a-z0-9]{10}-sums$/);
  const course = await (await req(`/courses/${courseId}`, as("u"))).json();
  expect(course.levels.map((l: { order: number; boss?: boolean }) => [l.order, !!l.boss])).toEqual([[1, false], [2, true]]);
  expect((await req(`/courses/${courseId}`, as("v"))).status).toBe(404); // private
  // events after a seq
  const later = await (await req(`/jobs/${jobId}?after=${p.events[2].seq}`, as("u"))).json() as JobPoll;
  expect(later.events[0].seq).toBe(p.events[3].seq);
  // every call shares the cached system prompt, uses the builder model and the fallback beta
  for (const c of ai.calls) expect(c.params).toMatchObject({ model: "claude-sonnet-5-5", fallbacks: "default", system: [{ cache_control: { type: "ephemeral" } }] });
  const usage = env.DB.tx((q) => q.get<{ usage: string }>("SELECT usage FROM jobs WHERE id = ?", jobId))!;
  expect(JSON.parse(usage.usage)).toMatchObject({ calls: 3, input: 30, output: 15 });
});

test("pre-check: a vague topic is 422 with suggestions and charges nothing; a failing check is skipped", async () => {
  ai = fakeAI(undefined, { ok: false, suggestions: ["Python asyncio", "Python typing", "x"] });
  const res = await build({ ...topic, topic: "python" });
  expect(res.status).toBe(422);
  expect(await res.json()).toMatchObject({ code: "topic_too_broad", suggestions: ["Python asyncio", "Python typing"] });
  expect(ledger.balance).toBe(1000);
  expect(ai.client.messages.create.mock.calls[0]).toMatchObject([{ model: "claude-haiku-5-5" }, { timeout: 15_000 }]);
  ai.client.messages.create.mockRejectedValueOnce(new Error("down"));
  expect((await build(topic)).status).toBe(202);
});

test("402 without credits, one build at a time, idempotent retry returns the same job", async () => {
  ledger.balance = 50;
  const poor = await build(topic);
  expect(poor.status).toBe(402);
  expect(await poor.json()).toMatchObject({ code: "insufficient_credits", cost: COSTS.course_topic, balance: 50 });
  ledger.balance = 1000;
  const key = crypto.randomUUID();
  const { jobId } = await (await build(topic, key)).json() as { jobId: string };
  const again = await build(topic, key);
  expect(again.status).toBe(202);
  expect((await again.json()).jobId).toBe(jobId);
  expect(ledger.balance).toBe(1000 - COSTS.course_topic);
  const second = await build(topic);
  expect(second.status).toBe(429);
  expect(await second.json()).toMatchObject({ code: "job_limit", jobId });
  expect((await build(topic, undefined, "v")).status).toBe(202); // per user
  const list = await (await req("/jobs?kind=build&active=1", as("u"))).json();
  expect(list.map((j: { id: string }) => j.id)).toEqual([jobId]);
  expect((await req(`/jobs/${jobId}`, as("v"))).status).toBe(404);
});

test("request validation", () => {
  expect(parseBuild({ ...topic, topic: "ab" })).toMatch(/Topic must be/);
  expect(parseBuild({ ...topic, level: "expert" })).toBe("Invalid level");
  expect(parseBuild({ mode: "files", level: "beginner", lang: "en" })).toMatch(/Add a file/);
  expect(parseBuild({ mode: "files", level: "beginner", lang: "en", urls: ["ftp://x"] })).toMatch(/URLs/);
  expect(parseBuild({ mode: "files", level: "beginner", lang: "en", urls: ["https://a.b", "https://a.b", "https://a.b", "https://a.b"] })).toMatch(/URLs/);
  expect(parseBuild({ mode: "files", level: "beginner", lang: "es-ES", uploads: ["a"], instructions: " x " })).toEqual({ mode: "files", level: "beginner", lang: "es-ES", uploads: ["a"], instructions: "x" });
});

test("outline reject fails the job and refunds", async () => {
  ai = fakeAI((kind) => (kind === "outline" ? msg([outline({ reject: "Unsafe topic" })]) : undefined));
  start();
  const { jobId } = await (await build(topic)).json() as { jobId: string };
  const p = await settle(jobId);
  expect(p.job.error).toEqual({ code: "build_rejected", message: "Unsafe topic", refunded: true });
  expect(p.events.at(-1)).toMatchObject({ type: "failed", data: { code: "build_rejected", refunded: true } });
  expect(ledger.balance).toBe(1000);
  expect(env.DB.tx((q) => q.get("SELECT 1 AS x FROM kv WHERE user_id = 'ledger'"))).toBeTruthy(); // refund ran inside the failure tx
});

test("fix loop repairs one level; MCQ-only output and bad JSON are sent back", async () => {
  const mcqOnly = { ...level("two"), challenges: level("two").challenges.slice(0, 2) };
  ai = fakeAI((kind) =>
    kind === "write:2" ? msg([text("not json")])
    : kind === "write:1" ? msg([fenced({ level: { ...level("one", { kata: "sum" }), challenges: [...mcqOnly.challenges.map((c) => ({ ...c, id: `x${c.id}` })), { id: "k", type: "kata", prompt: "S", kataId: "sum" }] }, katas: [kata("sum")] })])
    : undefined);
  start();
  const { jobId } = await (await build(topic)).json() as { jobId: string };
  const p = await settle(jobId);
  expect(p.job.status).toBe("done");
  expect(p.events.filter((e) => e.type === "problems").map((e) => e.data)).toEqual([{ attempt: 1, count: 1 }]);
  expect(ai.calls.map((c) => c.kind).filter((k) => k.startsWith("fix"))).toEqual(["fix:2"]);
  const fix = ai.calls.find((c) => c.kind === "fix:2")!;
  expect(JSON.stringify(fix.params.messages)).toMatch(/not returned as a JSON object/);
  expect(fix.params.output_config).toEqual({ effort: "medium" });
});

test("exhausted fix loop fails with build_invalid and refunds", async () => {
  ai = fakeAI((kind) => (kind.startsWith("write:2") || kind.startsWith("fix:2") ? msg([fenced({ level: { ...level("two"), challenges: [] }, katas: [kata("unused")] })]) : undefined));
  start();
  const { jobId } = await (await build(topic)).json() as { jobId: string };
  const p = await settle(jobId);
  expect(p.job.error).toMatchObject({ code: "build_invalid", refunded: true });
  expect(p.events.filter((e) => e.type === "problems")).toHaveLength(3);
  expect(ledger.balance).toBe(1000);
});

const search = (url: string, title: string) => ({ type: "web_search_result_location", url, title, cited_text: "x", encrypted_index: "e" });
test("web build: research with citations, sources on every card, invented URLs rejected", async () => {
  const urls = ["https://a.dev/1", "https://b.dev/2", "https://c.dev/3"];
  const cards = (src: string) => ({ ...level("two"), theory: [{ title: "C", blocks: [{ kind: "md", text: "T" }], sources: [{ url: src, title: "S" }] }] });
  ai = fakeAI((kind, n) =>
    kind === "research" ? { ...msg([text("Fact one", [search(urls[0], "A"), search(urls[1], "B")]), text(" and two", [search(urls[2], "C")])], n === 1 ? "pause_turn" : "end_turn"), usage: { input_tokens: 1, output_tokens: 1, server_tool_use: { web_search_requests: 2 } } }
    : kind === "write:1" ? msg([fenced({ level: { ...level("one", { kata: "sum" }), theory: cards(urls[0]).theory }, katas: [kata("sum")] })])
    : kind === "write:2" ? msg([fenced({ level: cards("https://invented.example/x"), katas: [] })])
    : kind === "fix:2" ? msg([fenced({ level: cards(urls[2]), katas: [] })])
    : undefined);
  start();
  const { jobId } = await (await build({ ...topic, mode: "web" })).json() as { jobId: string };
  const p = await settle(jobId);
  expect(p.job.status).toBe("done");
  expect(ledger.balance).toBe(1000 - COSTS.course_web);
  const stages = [...new Set(p.events.flatMap((e) => (e.type === "stage" ? [e.data.stage] : [])))];
  expect(stages).toEqual(["research", "outline", "write", "validate", "fix", "save"]);
  expect(p.events.find((e) => e.type === "sources")?.data).toEqual({ count: 3 });
  const research = ai.calls.filter((c) => c.kind === "research");
  expect(research).toHaveLength(2); // pause_turn continued once
  expect(research[0].params.tools).toEqual([{ type: "web_search_20260209", name: "web_search", max_uses: 8 }]);
  expect(JSON.stringify(ai.calls.find((c) => c.kind === "outline")!.params.messages)).toMatch(/\[1\] A https:\/\/a\.dev\/1/);
  expect(JSON.stringify(ai.calls.find((c) => c.kind === "fix:2")!.params.messages)).toMatch(/invented\.example.*is not one of the given sources/);
  expect(JSON.parse(env.DB.tx((q) => q.get<{ usage: string }>("SELECT usage FROM jobs WHERE id = ?", jobId))!.usage).searches).toBe(4);
});

test("web build with fewer than 3 sources fails with refund", async () => {
  ai = fakeAI((kind) => (kind === "research" ? msg([text("Fact", [search("https://a.dev/1", "A")])]) : undefined));
  start();
  const { jobId } = await (await build({ ...topic, mode: "web" })).json() as { jobId: string };
  expect((await settle(jobId)).job.error).toMatchObject({ code: "too_few_sources", refunded: true });
  expect(ledger.balance).toBe(1000);
});

test("files build: uploads, notes and URLs; unreachable URL fails with refund", async () => {
  const form = (name: string, body: BlobPart) => { const f = new FormData(); f.append("file", new File([body], name)); return f; };
  const pdf = await req("/builder/uploads", as("u", { method: "POST", body: form("a.pdf", "%PDF-1.7 ...") }));
  expect(pdf.status).toBe(200);
  const up = await pdf.json();
  expect(up).toMatchObject({ name: "a.pdf", bytes: 12 });
  expect(ai.client.files.upload).toHaveBeenCalledOnce();
  expect((await req("/builder/uploads", as("u", { method: "POST", body: form("x.bin", new Uint8Array([0xff, 0xfe, 0])) }))).status).toBe(415);
  expect((await req("/builder/uploads", as("u", { method: "POST", body: form("big.md", "a".repeat(500 * 1024 + 1)) }))).status).toBe(413);
  const note = await (await req("/notes", as("u", json("POST", { title: "Mine", body: "note body", tags: [] })))).json();
  expect((await build({ mode: "files", level: "beginner", lang: "en", uploads: [up.id] }, undefined, "v")).status).toBe(400); // not v's upload

  start();
  const { jobId } = await (await build({ mode: "files", level: "beginner", lang: "en", uploads: [up.id], noteIds: [note.id] })).json() as { jobId: string };
  const p = await settle(jobId);
  expect(p.job.status).toBe("done");
  expect([...new Set(p.events.flatMap((e) => (e.type === "stage" ? [e.data.stage] : [])))]).toEqual(["read", "outline", "write", "validate", "save"]);
  const content = JSON.stringify(ai.calls.find((c) => c.kind === "outline")!.params.messages);
  expect(content).toContain('"source":{"type":"file","file_id":"file_1"}');
  expect(content).toContain("note body");
  expect(ledger.balance).toBe(1000 - COSTS.course_files);

  const fetch = ai.calls.length;
  const res = await build({ mode: "files", level: "beginner", lang: "en", urls: ["https://github.com/a/b"] });
  const f = await settle((await res.json()).jobId);
  expect(f.job.error).toMatchObject({ code: "source_unreachable", refunded: true });
  expect(ai.calls[fetch].params.tools).toEqual([{ type: "web_fetch_20260209", name: "web_fetch", max_uses: 10, allowed_domains: ["github.com", "raw.githubusercontent.com"] }]);
});

test("jobs: boot recovery requeues once, then fails with refund; unknown errors are ai_failed", async () => {
  let n = 0;
  registerJob("narration", async () => { if (++n === 1) throw new Error("boom"); return { tracks: 1 }; });
  const a = enqueue(env.DB, { user: "u", kind: "narration", input: {}, spendId: null });
  const b = enqueue(env.DB, { user: "u", kind: "narration", input: {}, spendId: "spend-x" });
  ledger.spends.set("u:x", { id: "spend-x", cost: 10, ref: b });
  env.DB.tx((q) => {
    q.run("UPDATE jobs SET status = 'running', attempts = 1 WHERE id = ?", a);
    q.run("UPDATE jobs SET status = 'running', attempts = 2 WHERE id = ?", b);
  });
  start();
  const pa = await settle(a);
  expect(pa.job.status).toBe("failed"); // retried, then the handler threw
  expect(pa.job.error).toEqual({ code: "ai_failed", message: "AI request failed", refunded: false });
  const pb = await (await req(`/jobs/${b}`, as("u"))).json() as JobPoll;
  expect(pb.job.error).toMatchObject({ code: "ai_failed", refunded: true });
  const c = enqueue(env.DB, { user: "u", kind: "narration", input: {}, spendId: null });
  expect((await settle(c)).job).toMatchObject({ status: "done", result: { tracks: 1 } });
});

test("assemble and problem routing", () => {
  const o = { reject: "", slug: "s", title: "T", summary: "", levels: [{ id: "a", title: "A", goals: [], challengeTypes: [], kataIds: [] }, { id: "b", title: "B", goals: [], challengeTypes: [], kataIds: [] }], katas: [] };
  const c = assemble("u0000000000-s", "en", o, [{ level: { ...level("a"), boss: true, order: 9 }, katas: [] }, { level: level("b", { kata: "k" }), katas: [kata("k")] }]);
  expect(c.levels.map((l) => [l.order, l.boss])).toEqual([[1, undefined], [2, true]]);
  expect(c.summary).toBeUndefined();
  const m = problemsByLevel(c, ["levels[1].challenges[0]: bad", "katas[0] (k): solution fails", "(root): odd"]);
  expect([...m.entries()]).toEqual([[1, ["challenges[0]: bad", "katas[0] (k): solution fails"]], [0, ["(root): odd"]]]);
});

// Last: it replaces the build handler.
test("jobs: narration has its own lane, so running builds never hold it back", async () => {
  env.JOB_CONCURRENCY = 1;
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  registerJob("build", async () => { await gate; return {}; });
  registerJob("narration", async () => ({ tracks: 1 }));
  const b = enqueue(env.DB, { user: "u", kind: "build", input: {}, spendId: null });
  enqueue(env.DB, { user: "u", kind: "build", input: {}, spendId: null });
  const n = enqueue(env.DB, { user: "u", kind: "narration", input: {}, spendId: null });
  start();
  expect((await settle(n)).job.status).toBe("done");
  expect((await (await req(`/jobs/${b}`, as("u"))).json() as JobPoll).job.status).toBe("running");
  release();
  expect((await settle(b)).job.status).toBe("done");
});
