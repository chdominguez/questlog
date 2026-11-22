import { Hono } from "hono";
import { expect, test, vi } from "vitest";
import type { App, SessionUser } from "./api";
import { isAdmin, requireAdmin } from "./admin";
import { memoryDb } from "./db";
import { testEnv } from "./env";
import { err } from "./errors";
import { limit } from "./limits";

const user = (email: string, emailVerified = true): SessionUser => ({ id: email, email, name: "", emailVerified });

test("err: human text, stable code, extras, message override", async () => {
  const app = new Hono()
    .get("/a", (c) => err(c, 402, "insufficient_credits", { cost: 2, balance: 0 }))
    .get("/b", (c) => err(c, 400, "invalid_request", {}, "Invalid title"));
  const a = await app.request("/a");
  expect(a.status).toBe(402);
  expect(await a.json()).toEqual({ error: "Not enough credits", code: "insufficient_credits", cost: 2, balance: 0 });
  expect(await (await app.request("/b")).json()).toEqual({ error: "Invalid title", code: "invalid_request" });
});

test("isAdmin needs a verified email in ADMIN_EMAILS, case-insensitive", () => {
  const env = testEnv(memoryDb(), { ADMIN_EMAILS: ["boss@x.com"] });
  expect(isAdmin(user("Boss@X.com"), env)).toBe(true);
  expect(isAdmin(user("boss@x.com", false), env)).toBe(false);
  expect(isAdmin(user("u@x.com"), env)).toBe(false);
});

test("requireAdmin and limit", async () => {
  const env = testEnv(memoryDb(), { ADMIN_EMAILS: ["boss@x.com"] });
  const app = new Hono<App>()
    .use(async (c, next) => { const u = user(c.req.header("x-user")!); c.set("user", u.id); c.set("account", u); await next(); })
    .get("/admin", requireAdmin, (c) => c.text("ok"))
    .get("/limited", limit("t", 2, 60), (c) => c.text("ok"));
  const as = (u: string) => ({ headers: { "x-user": u } });
  expect((await app.request("/admin", as("boss@x.com"), env)).status).toBe(200);
  expect((await app.request("/admin", as("u@x.com"), env)).status).toBe(403);

  vi.useFakeTimers();
  try {
    expect((await app.request("/limited", as("a"), env)).status).toBe(200);
    expect((await app.request("/limited", as("a"), env)).status).toBe(200);
    const res = await app.request("/limited", as("a"), env);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect((await app.request("/limited", as("b"), env)).status).toBe(200);
    vi.advanceTimersByTime(60_000);
    expect((await app.request("/limited", as("a"), env)).status).toBe(200);
  } finally { vi.useRealTimers(); }
});
