import type { Db } from "./db";

/** Server config, read once at boot by readEnv. Lists are split on commas; see docs/design/questie.md 3.8. */
export interface Env {
  DB: Db;
  DB_PATH: string;
  MEDIA_DIR?: string;
  MEDIA_MAX_BYTES: number;
  HOST: string;
  PORT: number;
  APP_URL: string;
  APP_ORIGINS: string[]; // bearer-only trusted origins (Capacitor)
  IP_HEADER: string;
  BETTER_AUTH_SECRET: string;
  SIGNUP: "open" | "closed";
  ADMIN_EMAILS: string[]; // lowercased
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_NATIVE_CLIENT_IDS: string[];
  APPLE_CLIENT_ID?: string;
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_KEY?: string;
  APPLE_BUNDLE_ID?: string;
  ANTHROPIC_API_KEY?: string;
  JOB_CONCURRENCY: number;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_VOICES: string[]; // first is the default
  ELEVENLABS_MODEL: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  REVENUECAT_WEBHOOK_AUTH?: string;
  CREDITS_NOTICE?: string;
  VAPID_PUBLIC?: string; // web push public key; unset = reminders off
  VAPID_PRIVATE?: string;
  VAPID_SUBJECT?: string;
  FCM_SERVICE_ACCOUNT?: string; // base64 service-account JSON
  COMMIT: string;
}

type Src = Record<string, string | undefined>;

const list = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const int = (name: string, v: string | undefined, dflt: number) => {
  if (!v) return dflt;
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer`);
  return n;
};

/** Reads and checks the environment. Throws on a config the server cannot run with. */
export function readEnv(src: Src = process.env): Omit<Env, "DB"> {
  const s = (k: string) => src[k]?.trim() || undefined;
  const APP_URL = s("APP_URL")?.replace(/\/+$/, "");
  if (!APP_URL) throw new Error("APP_URL is required");
  const BETTER_AUTH_SECRET = s("BETTER_AUTH_SECRET");
  if (!BETTER_AUTH_SECRET) throw new Error("BETTER_AUTH_SECRET is required");
  if (!s("STRIPE_SECRET_KEY") !== !s("STRIPE_WEBHOOK_SECRET")) throw new Error("Set both STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET, or neither");
  const voices = list(src.ELEVENLABS_VOICES);
  if (s("ELEVENLABS_API_KEY") && !voices.length) throw new Error("ELEVENLABS_VOICES is required with ELEVENLABS_API_KEY");
  const signup = s("SIGNUP") ?? "open";
  if (signup !== "open" && signup !== "closed") throw new Error("SIGNUP must be open or closed");
  const DB_PATH = s("DB_PATH") ?? "data/questlog.db";
  return {
    DB_PATH,
    MEDIA_DIR: s("MEDIA_DIR"),
    MEDIA_MAX_BYTES: int("MEDIA_MAX_BYTES", s("MEDIA_MAX_BYTES"), 52_428_800),
    HOST: s("HOST") ?? "127.0.0.1",
    PORT: int("PORT", s("PORT"), 8787),
    APP_URL,
    APP_ORIGINS: src.APP_ORIGINS === undefined ? ["capacitor://localhost", "https://localhost"] : list(src.APP_ORIGINS),
    IP_HEADER: s("IP_HEADER")?.toLowerCase() ?? "x-forwarded-for",
    BETTER_AUTH_SECRET,
    SIGNUP: signup,
    ADMIN_EMAILS: list(src.ADMIN_EMAILS).map((e) => e.toLowerCase()),
    RESEND_API_KEY: s("RESEND_API_KEY"),
    EMAIL_FROM: s("EMAIL_FROM"),
    GOOGLE_CLIENT_ID: s("GOOGLE_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: s("GOOGLE_CLIENT_SECRET"),
    GOOGLE_NATIVE_CLIENT_IDS: list(src.GOOGLE_NATIVE_CLIENT_IDS),
    APPLE_CLIENT_ID: s("APPLE_CLIENT_ID"),
    APPLE_TEAM_ID: s("APPLE_TEAM_ID"),
    APPLE_KEY_ID: s("APPLE_KEY_ID"),
    APPLE_PRIVATE_KEY: s("APPLE_PRIVATE_KEY"),
    APPLE_BUNDLE_ID: s("APPLE_BUNDLE_ID"),
    ANTHROPIC_API_KEY: s("ANTHROPIC_API_KEY"),
    JOB_CONCURRENCY: Math.max(1, int("JOB_CONCURRENCY", s("JOB_CONCURRENCY"), 2)),
    ELEVENLABS_API_KEY: s("ELEVENLABS_API_KEY"),
    ELEVENLABS_VOICES: voices,
    ELEVENLABS_MODEL: s("ELEVENLABS_MODEL") ?? "eleven_multilingual_v2",
    STRIPE_SECRET_KEY: s("STRIPE_SECRET_KEY"),
    STRIPE_WEBHOOK_SECRET: s("STRIPE_WEBHOOK_SECRET"),
    REVENUECAT_WEBHOOK_AUTH: s("REVENUECAT_WEBHOOK_AUTH"),
    CREDITS_NOTICE: s("CREDITS_NOTICE"),
    VAPID_PUBLIC: s("VAPID_PUBLIC"),
    VAPID_PRIVATE: s("VAPID_PRIVATE"),
    VAPID_SUBJECT: s("VAPID_SUBJECT"),
    FCM_SERVICE_ACCOUNT: s("FCM_SERVICE_ACCOUNT"),
    COMMIT: s("COMMIT") ?? import.meta.env?.VITE_COMMIT ?? "dev",
  };
}

/** A valid Env for tests: the required vars set, everything optional off, `over` on top. */
export const testEnv = (DB: Db, over: Partial<Env> = {}): Env =>
  ({ ...readEnv({ APP_URL: "http://localhost", BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret" }), DB, ...over });
