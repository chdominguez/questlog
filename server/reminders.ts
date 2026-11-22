import { sendNotification, setVapidDetails } from "web-push";
import type { Deps } from "./api";
import type { Db } from "./db";
import type { Env } from "./env";
import { fcmSender, type FcmSend } from "./fcm";

export const WINDOW_MIN = 5;

const parts = (now: Date, tz: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
};

export const validZone = (tz: string) => { try { parts(new Date(), tz); return true; } catch { return false; } };

/** The user's local date if this reminder should fire now (first WINDOW_MIN minutes from `time`, once per local day), else null. */
export function dueDate(now: Date, tz: string, time: string, lastSent: string): string | null {
  const { date, minutes } = parts(now, tz);
  const [h, m] = time.split(":").map(Number);
  const since = minutes - (h * 60 + m);
  return date !== lastSent && since >= 0 && since < WINDOW_MIN ? date : null;
}

type Sub = { endpoint: string; p256dh: string; auth: string };
export type Send = (sub: Sub, payload: string) => Promise<void>;

export const webPushSend = (publicKey: string, privateKey: string, subject: string): Send => {
  setVapidDetails(subject, publicKey, privateKey);
  return (s, payload) => sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { timeout: 10_000 }).then(() => {});
};

export interface Senders { web?: Send; fcm?: FcmSend }

/** Sends every reminder that is due to the user's web subscriptions and native devices. Dead subscriptions and tokens are dropped. */
export async function runReminders(db: Db, { web, fcm }: Senders, now = new Date()) {
  const { results } = await db.prepare("SELECT user_id, course_id, title, time, tz, last_sent FROM reminders").all<{
    user_id: string; course_id: string; title: string; time: string; tz: string; last_sent: string;
  }>();
  // Every due row is marked sent in one transaction before any send, so a later sweep never sends it again.
  const due = results.flatMap((r) => { const date = dueDate(now, r.tz, r.time, r.last_sent); return date ? [{ ...r, date }] : []; });
  db.tx((q) => { for (const r of due) q.run("UPDATE reminders SET last_sent = ? WHERE user_id = ? AND course_id = ?", r.date, r.user_id, r.course_id); });
  for (const r of due) {
    const msg = { title: r.title, body: "Time to study", url: `/#/c/${encodeURIComponent(r.course_id)}` };
    if (web) {
      const { results: subs } = await db.prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?").bind(r.user_id).all<Sub>();
      const payload = JSON.stringify({ ...msg, tag: r.course_id });
      for (const s of subs) {
        try { await web(s, payload); } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(s.endpoint).run();
          else console.error("push failed:", e);
        }
      }
    }
    if (fcm) {
      const { results: devices } = await db.prepare("SELECT token FROM device_tokens WHERE user_id = ?").bind(r.user_id).all<{ token: string }>();
      for (const { token } of devices) {
        try {
          if (await fcm(token, msg) === "gone") await db.prepare("DELETE FROM device_tokens WHERE token = ?").bind(token).run();
        } catch (e) { console.error("native push failed:", e); }
      }
    }
  }
}

/** Runs reminders every minute when Web Push or FCM is configured; returns stop. */
export function startReminders(env: Env, deps: Deps): () => void {
  const { VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT, FCM_SERVICE_ACCOUNT } = env;
  const senders: Senders = {};
  if (VAPID_PUBLIC && VAPID_PRIVATE && VAPID_SUBJECT) senders.web = webPushSend(VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT);
  if (FCM_SERVICE_ACCOUNT) {
    try { senders.fcm = fcmSender(FCM_SERVICE_ACCOUNT, deps.fetch); } catch (e) { console.error("FCM_SERVICE_ACCOUNT invalid, native push off:", e); }
  }
  if (!senders.web && !senders.fcm) return () => {};
  // The next sweep starts a minute after this one ends, so sweeps never overlap.
  let t: ReturnType<typeof setTimeout>;
  let stopped = false;
  const next = () => {
    t = setTimeout(() => {
      runReminders(env.DB, senders, deps.now()).catch((e) => console.error("reminders failed:", e)).finally(() => { if (!stopped) next(); });
    }, 60_000);
  };
  next();
  return () => { stopped = true; clearTimeout(t); };
}
