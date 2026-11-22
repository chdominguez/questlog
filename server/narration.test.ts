import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { NarrationState } from "../shared/api-types";
import { CourseSchema } from "../src/course/schema";
import { resolve } from "../src/course/registry";
import { createApi, defaultDeps, type Deps, type Env } from "./api";
import { memoryDb } from "./db";
import { testEnv } from "./env";
import { startJobs } from "./jobs";
import { ensureAudio } from "./narration";

// Fake credits ledger (WP4 owns the real one).
const bank = vi.hoisted(() => ({ balance: 0, spends: new Map<string, { cost: number; refunded: boolean }>() }));
vi.mock("./credits", async (orig) => {
  const real = await orig<typeof import("./credits")>();
  const { COSTS } = await import("../shared/pricing");
  const spend: typeof real.spend = (_db, _env, a) => {
    const cost = COSTS[a.action];
    if (bank.balance < cost) return { ok: false, code: "insufficient_credits", cost, balance: bank.balance };
    bank.balance -= cost;
    const spendId = `s${bank.spends.size + 1}`;
    bank.spends.set(spendId, { cost, refunded: false });
    return { ok: true, spendId, free: false, replay: false, balance: bank.balance };
  };
  const refund: typeof real.refund = (_db, id) => {
    const s = bank.spends.get(id);
    if (!s || s.refunded) return false;
    s.refunded = true;
    bank.balance += s.cost;
    return true;
  };
  return { ...real, metered: () => true, spend, refund };
});

const course = resolve(CourseSchema.parse({
  id: "t", title: "T", lang: "en",
  levels: [
    { id: "l1", order: 1, title: "Basics", theory: [
      { title: "One", blocks: [{ kind: "md", text: "First **card**." }] },
      { title: "Two", blocks: [{ kind: "code", lang: "ts", src: "x" }] },
    ], challenges: [{ id: "q", type: "quiz", prompt: "Q", options: ["a", "b"], answer: 0 }] },
    { id: "l2", order: 2, title: "Empty", theory: [], challenges: [{ id: "q2", type: "quiz", prompt: "Q", options: ["a", "b"], answer: 0 }] },
  ],
}));

let env: Env;
let deps: Deps;
let tts: { url: string; key: string | null; body: Record<string, unknown> }[];
let ttsStatus: number;
let stop: () => void;
beforeEach(() => {
  env = testEnv(memoryDb(), { ELEVENLABS_API_KEY: "el-key", ELEVENLABS_VOICES: ["v1", "v2"], MEDIA_DIR: mkdtempSync(join(tmpdir(), "questie-nar-")) });
  bank.balance = 100;
  bank.spends.clear();
  tts = [];
  ttsStatus = 200;
  deps = defaultDeps({
    courses: [course],
    session: async (c) => ({ id: c.req.header("x-test-user") ?? "u", email: "u@x.com", name: "U", emailVerified: true }),
    fetch: (async (url: string, init: RequestInit) => {
      tts.push({ url, key: new Headers(init.headers).get("xi-api-key"), body: JSON.parse(String(init.body)) });
      return new Response(ttsStatus === 200 ? `mp3:${tts.length}` : "no", { status: ttsStatus });
    }) as typeof fetch,
  });
  stop = startJobs(env, deps);
});
afterEach(() => stop());

const req = (path: string, init: RequestInit = {}, user = "u") =>
  createApi(deps).request(path, { ...init, headers: { ...(init.headers as object), "x-test-user": user } }, env);
const unlock = (user = "u", body: object = {}) => req("/narration", {
  method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
  body: JSON.stringify({ courseId: "t", levelId: "t:l1", ...body }),
}, user);
const getState = async (user = "u", q = "") => (await (await req(`/narration/t/t%3Al1${q}`, {}, user)).json()) as NarrationState;
const until = async (ok: () => boolean | Promise<boolean>) => {
  for (let i = 0; i < 100 && !(await ok()); i++) await new Promise((r) => setTimeout(r, 10));
};

test("locked state; 503 without ElevenLabs; bad voice and empty level 400", async () => {
  const s = await getState();
  expect(s).toMatchObject({ unlocked: false, cost: 10, voice: "v1" });
  expect(s.tracks.map((t) => [t.card, t.ready])).toEqual([[0, false], [1, false]]);
  expect(s.tracks[0].hash).toMatch(/^[a-f0-9]{64}$/);
  expect((await req("/narration/t/t%3Al1?voice=nope")).status).toBe(400);
  expect((await unlock("u", { levelId: "t:l2" })).status).toBe(400);
  expect((await unlock("u", { levelId: "t:zz" })).status).toBe(404);
  env = { ...env, ELEVENLABS_API_KEY: undefined };
  expect((await unlock()).status).toBe(503);
  expect(bank.balance).toBe(100);
});

test("charges once per user + lesson + voice; cached audio skips the job", async () => {
  const first = (await (await unlock()).json()) as NarrationState;
  expect(first.unlocked).toBe(true);
  expect(first.jobId).toBeTruthy();
  expect(bank.balance).toBe(90);
  await until(async () => (await getState()).tracks.every((t) => t.ready));
  expect(tts).toHaveLength(2);
  expect(tts[0].url).toBe("https://api.elevenlabs.io/v1/text-to-speech/v1?output_format=mp3_44100_128");
  expect(tts[0].key).toBe("el-key");
  expect(tts[0].body).toEqual({ text: "One\n\nFirst card.", model_id: "eleven_multilingual_v2" });
  expect(tts[1].body.text).toBe("Two\n\nCode example.");

  const again = (await (await unlock()).json()) as NarrationState;
  expect(again.jobId).toBeUndefined();
  expect(bank.balance).toBe(90);

  const other = (await (await unlock("w")).json()) as NarrationState; // someone else's cache hit still costs them once
  expect(other.jobId).toBeUndefined();
  expect(other.tracks.every((t) => t.ready)).toBe(true);
  expect(bank.balance).toBe(80);

  await unlock("u", { voice: "v2" }); // another voice is another lesson
  expect(bank.balance).toBe(70);
  await until(() => tts.length === 4);
  expect(tts.length).toBe(4);
});

test("an edited user-course lesson needs a new unlock", async () => {
  await unlock();
  expect(bank.balance).toBe(90);
  expect((await getState()).unlocked).toBe(true);
  const edited = structuredClone(course);
  edited.levels[0].theory[0].blocks = [{ kind: "md", text: "New text." }];
  deps.courses = [edited];
  expect((await getState()).unlocked).toBe(false);
  expect((await (await unlock()).json()).unlocked).toBe(true);
  expect(bank.balance).toBe(80);
  expect((await getState()).unlocked).toBe(true);
});

test("a lesson above the character cap is not narrated", async () => {
  const long = structuredClone(course);
  long.levels[0].theory[0].blocks = [{ kind: "md", text: "word ".repeat(3000) }];
  deps.courses = [long];
  expect((await req("/narration/t/t%3Al1")).status).toBe(400);
  const res = await unlock();
  expect(res.status).toBe(400);
  expect((await res.json()).code).toBe("too_large");
  expect(bank.balance).toBe(100);
});

test("audio route requires an unlock and serves ranges with long cache", async () => {
  await unlock();
  const { tracks } = await getState();
  await until(async () => (await getState()).tracks.every((t) => t.ready));
  const path = `/narration/audio/${tracks[0].hash}`;
  expect((await req(path, {}, "w")).status).toBe(403);
  expect((await req("/narration/audio/nothex")).status).toBe(404);
  const r = await req(path);
  expect(r.status).toBe(200);
  expect(r.headers.get("Content-Type")).toBe("audio/mpeg");
  expect(r.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
  expect(await r.text()).toBe("mp3:1");
  const part = await req(path, { headers: { Range: "bytes=0-2" } });
  expect(part.status).toBe(206);
  expect(await part.text()).toBe("mp3");
});

test("job failure refunds and removes the unlock", async () => {
  ttsStatus = 500;
  const res = (await (await unlock()).json()) as NarrationState;
  expect(res.jobId).toBeTruthy();
  expect(bank.spends.get("s1")?.cost).toBe(10); // the real job worker may already have refunded
  await until(() => bank.balance === 100);
  await until(async () => !(await getState()).unlocked);
  expect(bank.balance).toBe(100);
  expect((await getState()).unlocked).toBe(false);
});

test("a job interrupted twice is refunded and removes the unlock", async () => {
  stop();
  const { jobId } = (await (await unlock()).json()) as NarrationState;
  env.DB.tx((q) => q.run("UPDATE jobs SET status = 'running', attempts = 2 WHERE id = ?", jobId));
  stop = startJobs(env, deps);
  expect(bank.balance).toBe(100);
  expect((await getState()).unlocked).toBe(false);
});

test("402 without credits: no unlock, no audio", async () => {
  bank.balance = 5;
  const res = await unlock();
  expect(res.status).toBe(402);
  expect(await res.json()).toMatchObject({ code: "insufficient_credits", cost: 10, balance: 5 });
  expect((await getState()).unlocked).toBe(false);
  expect(tts).toHaveLength(0);
});

test("single-flight per hash; long text goes in chunks with context", async () => {
  const t = { card: 0, hash: "a".repeat(64), text: "short" };
  await Promise.all([ensureAudio(env.DB, env, deps.fetch, "v1", t), ensureAudio(env.DB, env, deps.fetch, "v1", t)]);
  expect(tts).toHaveLength(1);
  await ensureAudio(env.DB, env, deps.fetch, "v1", t); // file exists now
  expect(tts).toHaveLength(1);

  const long = `${"a".repeat(6000)}\n\n${"b".repeat(6000)}`;
  await ensureAudio(env.DB, env, deps.fetch, "v1", { card: 0, hash: "b".repeat(64), text: long });
  expect(tts.slice(1).map((x) => [String(x.body.text)[0], !!x.body.previous_text, !!x.body.next_text])).toEqual([["a", false, true], ["b", true, false]]);
});
