import { Hono } from "hono";
import { afterEach, beforeEach, expect, test } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Grade, GradeRequest, SavedAnswer } from "../shared/api-types";
import { createApi, MAX_ANSWER } from "./api";

let dir: string;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), "eq-api-")); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

const grade: Grade = { score: 7, covered: ["a"], missing: ["b"], mistakes: [], improved: "Yo lo haría así." };
const gradeReq: GradeRequest = { challengeId: "c1", prompt: "¿Qué es X?", model: "X es Y", keyPoints: ["a", "b"], answer: "X es algo" };
const post = (body: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("health and grade report 503 without a grader", async () => {
  const app = createApi({ dataDir: dir, grader: null });
  expect(await (await app.request("/health")).json()).toEqual({ ok: true, grader: false });
  const res = await app.request("/grade", post(gradeReq));
  expect(res.status).toBe(503);
  expect((await res.json()).error).toBeTruthy();
});

test("grade validates the body and calls the grader", async () => {
  const seen: GradeRequest[] = [];
  const app = createApi({ dataDir: dir, grader: async (r) => { seen.push(r); return grade; } });
  expect((await (await app.request("/health")).json()).grader).toBe(true);
  for (const bad of [{}, { ...gradeReq, answer: "" }, { ...gradeReq, answer: "x".repeat(MAX_ANSWER + 1) }, { ...gradeReq, keyPoints: "a" }]) {
    expect((await app.request("/grade", post(bad))).status).toBe(400);
  }
  expect((await app.request("/grade", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{nope" })).status).toBe(400);
  const res = await app.request("/grade", post({ ...gradeReq, extra: 1 }));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual(grade);
  expect(seen).toEqual([gradeReq]);
});

test("grader failure returns 502", async () => {
  const app = createApi({ dataDir: dir, grader: async () => { throw new Error("boom"); } });
  expect((await app.request("/grade", post(gradeReq))).status).toBe(502);
});

test("save, list and export round-trip", async () => {
  const app = createApi({ dataDir: join(dir, "nested"), grader: null });
  expect(await (await app.request("/answers")).json()).toEqual([]);
  const base = { challengeId: "c1", levelId: "l1", prompt: "¿Qué es X?", answer: "Primera", source: "typed" };
  expect((await app.request("/answers", post({ ...base, source: "voice" }))).status).toBe(400);
  expect((await app.request("/answers", post({ ...base, grade: { score: "9" } }))).status).toBe(400);
  expect((await app.request("/answers", post({ ...base, seconds: -1 }))).status).toBe(400);

  const r1 = await app.request("/answers", post(base));
  expect(r1.status).toBe(201);
  const a1 = (await r1.json()) as SavedAnswer;
  expect(a1.id).toBeTruthy();
  expect(a1.grade).toBeUndefined();
  await app.request("/answers", post({ ...base, answer: "Segunda", source: "mixed", seconds: 42, grade: { ...grade, score: 14 } }));
  expect((await app.request("/answers", post({ ...base, selfScore: 11 }))).status).toBe(400);
  expect((await app.request("/answers", post({ ...base, selfScore: "9" }))).status).toBe(400);
  await app.request("/answers", post({ ...base, challengeId: "c2", prompt: "¿Y Z?", answer: "Otra", selfScore: 6 }));

  const all = (await (await app.request("/answers")).json()) as SavedAnswer[];
  expect(all.map((a) => a.answer)).toEqual(["Otra", "Segunda", "Primera"]);
  expect(all[1].grade?.score).toBe(10);
  expect(all[0].selfScore).toBe(6);
  expect(all[1].selfScore).toBeUndefined();
  const c1 = (await (await app.request("/answers?challengeId=c1")).json()) as SavedAnswer[];
  expect(c1.map((a) => a.answer)).toEqual(["Segunda", "Primera"]);

  const exp = await app.request("/export");
  expect(exp.headers.get("content-type")).toContain("text/markdown");
  const md = await exp.text();
  expect(md).toContain("## l1");
  expect(md).toContain("### ¿Qué es X?");
  expect(md).toContain("### ¿Y Z?");
  expect(md.indexOf("Primera")).toBeLessThan(md.indexOf("Segunda"));
  expect(md).toContain("10/10");
  expect(md).toContain("6/10 (self-rated)");
  expect(md).toContain("ungraded");
  expect(md).toContain("- b");
  expect(md).toContain("Yo lo haría así.");
});

test("rejects oversized bodies", async () => {
  const app = createApi({ dataDir: dir, grader: null });
  const res = await app.request("/answers", { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": String(200 * 1024) }, body: "x".repeat(200 * 1024) });
  expect(res.status).toBe(413);
});

test("rejects cross-site and non-JSON requests", async () => {
  const app = createApi({ dataDir: dir, grader: async () => grade });
  const h = (headers: Record<string, string>) => ({ ...post(gradeReq), headers: { "Content-Type": "application/json", ...headers } });
  expect((await app.request("/grade", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(gradeReq) })).status).toBe(415);
  expect((await app.request("/grade", { method: "POST", body: JSON.stringify(gradeReq) })).status).toBe(415);
  expect((await app.request("/grade", h({ "Sec-Fetch-Site": "cross-site" }))).status).toBe(403);
  expect((await app.request("/grade", h({ "Sec-Fetch-Site": "same-site" }))).status).toBe(403);
  expect((await app.request("/grade", h({ Host: "localhost:5180", Origin: "http://evil.test" }))).status).toBe(403);
  expect((await app.request("/grade", h({ Host: "localhost:5180", Origin: "http://localhost:3000" }))).status).toBe(403);
  expect((await app.request("/export", { headers: { Host: "evil.test:5180" } })).status).toBe(403);
  expect((await app.request("/grade", h({ Host: "localhost:5180", Origin: "http://localhost:5180", "Sec-Fetch-Site": "same-origin" }))).status).toBe(200);
  expect((await app.request("/export", { headers: { Host: "127.0.0.1:5180", "Sec-Fetch-Site": "none" } })).status).toBe(200);
});

test("unknown API paths return a JSON 404 even with an SPA fallback mounted", async () => {
  const app = new Hono();
  app.route("/api", createApi({ dataDir: dir, grader: null }));
  app.get("*", (c) => c.text("spa"));
  const res = await app.request("/api/nope");
  expect(res.status).toBe(404);
  expect((await res.json()).error).toBeTruthy();
  expect(await (await app.request("/mapa")).text()).toBe("spa");
});
