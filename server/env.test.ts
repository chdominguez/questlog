import { expect, test } from "vitest";
import { readEnv } from "./env";

const base = { APP_URL: "https://app.test/", BETTER_AUTH_SECRET: "s".repeat(32) };

test("boot checks: APP_URL and BETTER_AUTH_SECRET required, Stripe vars come in pairs", () => {
  expect(() => readEnv({ BETTER_AUTH_SECRET: "s" })).toThrow("APP_URL");
  expect(() => readEnv({ APP_URL: "https://a" })).toThrow("BETTER_AUTH_SECRET");
  expect(() => readEnv({ ...base, STRIPE_SECRET_KEY: "sk" })).toThrow("STRIPE");
  expect(() => readEnv({ ...base, STRIPE_WEBHOOK_SECRET: "wh" })).toThrow("STRIPE");
  expect(readEnv({ ...base, STRIPE_SECRET_KEY: "sk", STRIPE_WEBHOOK_SECRET: "wh" }).STRIPE_SECRET_KEY).toBe("sk");
  expect(() => readEnv({ ...base, ELEVENLABS_API_KEY: "k" })).toThrow("ELEVENLABS_VOICES");
  expect(() => readEnv({ ...base, SIGNUP: "maybe" })).toThrow("SIGNUP");
  expect(() => readEnv({ ...base, PORT: "x" })).toThrow("PORT");
});

test("defaults and parsing", () => {
  const e = readEnv(base);
  expect(e).toMatchObject({
    APP_URL: "https://app.test", DB_PATH: "data/questlog.db", HOST: "127.0.0.1", PORT: 8787,
    APP_ORIGINS: ["capacitor://localhost", "https://localhost"], IP_HEADER: "x-forwarded-for", SIGNUP: "open",
    ADMIN_EMAILS: [], JOB_CONCURRENCY: 2, ELEVENLABS_MODEL: "eleven_multilingual_v2", MEDIA_MAX_BYTES: 52428800,
  });
  expect(e.ANTHROPIC_API_KEY).toBeUndefined();
  const f = readEnv({ ...base, ADMIN_EMAILS: " A@x.com, b@y.com ,", APP_ORIGINS: "", ELEVENLABS_API_KEY: "k", ELEVENLABS_VOICES: "v1,v2", PORT: "9000", ANTHROPIC_API_KEY: " " });
  expect(f.ADMIN_EMAILS).toEqual(["a@x.com", "b@y.com"]);
  expect(f.APP_ORIGINS).toEqual([]);
  expect(f.ELEVENLABS_VOICES).toEqual(["v1", "v2"]);
  expect(f.PORT).toBe(9000);
  expect(f.ANTHROPIC_API_KEY).toBeUndefined();
});
