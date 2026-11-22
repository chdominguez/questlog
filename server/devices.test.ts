import { beforeEach, expect, test } from "vitest";
import { createApi, type Deps, type Env } from "./api";
import { memoryDb } from "./db";
import { testEnv } from "./env";

let env: Env;
beforeEach(() => { env = testEnv(memoryDb()); });

const session: Deps["session"] = async (c) => {
  const id = c.req.header("x-test-user") ?? "u";
  return id ? { id, email: `${id}@x.com`, name: id, emailVerified: true } : null;
};
const app = createApi({ session, now: () => new Date("2026-11-22T10:00:00Z") });
const req = (method: string, user: string, body: unknown) =>
  app.request("/push/device", { method, headers: { "Content-Type": "application/json", "x-test-user": user }, body: JSON.stringify(body) }, env);
const rows = async () => (await env.DB.prepare("SELECT token, user_id, platform, created_at FROM device_tokens ORDER BY token").all()).results;

test("POST /push/device validates and upserts; the last user to register a token owns it", async () => {
  expect((await req("POST", "a", { token: "", platform: "ios" })).status).toBe(400);
  expect((await req("POST", "a", { token: "t1", platform: "web" })).status).toBe(400);
  expect((await req("POST", "a", { token: "t1", platform: "ios" })).status).toBe(204);
  expect((await req("POST", "a", { token: "t1", platform: "ios" })).status).toBe(204);
  expect((await req("POST", "b", { token: "t1", platform: "android" })).status).toBe(204);
  expect(await rows()).toEqual([{ token: "t1", user_id: "b", platform: "android", created_at: "2026-11-22T10:00:00.000Z" }]);
});

test("DELETE /push/device removes only the caller's own token", async () => {
  await req("POST", "a", { token: "ta", platform: "ios" });
  await req("POST", "b", { token: "tb", platform: "android" });
  expect((await req("DELETE", "a", { token: "tb" })).status).toBe(204);
  expect((await req("DELETE", "a", { token: "ta" })).status).toBe(204);
  expect((await req("DELETE", "a", {})).status).toBe(400);
  expect(await rows()).toMatchObject([{ token: "tb", user_id: "b" }]);
});

test("device routes need a session", async () => {
  expect((await req("POST", "", { token: "t", platform: "ios" })).status).toBe(401);
});
