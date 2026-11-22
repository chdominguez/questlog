import { createSign } from "node:crypto";

// FCM HTTP v1 sender for native reminders (Android, and iOS through the APNs key uploaded to Firebase).

interface Account { project_id: string; client_email: string; private_key: string; token_uri?: string }
export interface FcmMessage { title: string; body: string; url: string }
/** "gone" = FCM reports the token UNREGISTERED; the caller drops it. Other failures throw. */
export type FcmSend = (token: string, m: FcmMessage) => Promise<"ok" | "gone">;

const TOKEN_URI = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const b64url = (s: string) => Buffer.from(s).toString("base64url");

/** Service-account JWT (RS256) exchanged for an OAuth access token. */
export function assertion(a: Account, nowMs: number): string {
  const iat = Math.floor(nowMs / 1000);
  const body = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({
    iss: a.client_email, scope: SCOPE, aud: a.token_uri ?? TOKEN_URI, iat, exp: iat + 3600,
  }))}`;
  return `${body}.${createSign("RSA-SHA256").update(body).sign(a.private_key, "base64url")}`;
}

const unregistered = (b: unknown) =>
  ((b as { error?: { details?: { errorCode?: string }[] } })?.error?.details ?? []).some((d) => d.errorCode === "UNREGISTERED");

/** `serviceAccount` is the base64 JSON from FCM_SERVICE_ACCOUNT. The access token is cached until a minute before it expires. */
export function fcmSender(serviceAccount: string, f: typeof fetch, now = () => Date.now()): FcmSend {
  const a = JSON.parse(Buffer.from(serviceAccount, "base64").toString("utf8")) as Account;
  if (!a.project_id || !a.client_email || !a.private_key) throw new Error("FCM_SERVICE_ACCOUNT is missing project_id, client_email or private_key");
  let cached: { token: string; until: number } | null = null;
  const access = async () => {
    if (cached && cached.until > now()) return cached.token;
    const res = await f(a.token_uri ?? TOKEN_URI, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: assertion(a, now()) }),
    });
    if (!res.ok) throw new Error(`FCM auth failed: ${res.status}`);
    const j = (await res.json()) as { access_token: string; expires_in: number };
    cached = { token: j.access_token, until: now() + (j.expires_in - 60) * 1000 };
    return cached.token;
  };
  return async (token, m) => {
    const res = await f(`https://fcm.googleapis.com/v1/projects/${a.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await access()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { token, notification: { title: m.title, body: m.body }, data: { url: m.url } } }),
    });
    if (res.ok) return "ok";
    if (unregistered(await res.json().catch(() => null))) return "gone";
    throw new Error(`FCM send failed: ${res.status}`);
  };
}
