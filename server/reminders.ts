import { sendNotification, setVapidDetails } from "web-push";
import type { Db } from "./api";

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
  return (s, payload) => sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload).then(() => {});
};

/** Sends every reminder that is due. A dead subscription (404/410) is dropped. */
export async function runReminders(db: Db, send: Send, now = new Date()) {
  const { results } = await db.prepare("SELECT user_id, course_id, title, time, tz, last_sent FROM reminders").all<{
    user_id: string; course_id: string; title: string; time: string; tz: string; last_sent: string;
  }>();
  for (const r of results) {
    const date = dueDate(now, r.tz, r.time, r.last_sent);
    if (!date) continue;
    await db.prepare("UPDATE reminders SET last_sent = ? WHERE user_id = ? AND course_id = ?").bind(date, r.user_id, r.course_id).run();
    const { results: subs } = await db.prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?").bind(r.user_id).all<Sub>();
    const payload = JSON.stringify({ title: r.title, body: "Time to study", url: `/#/c/${encodeURIComponent(r.course_id)}`, tag: r.course_id });
    for (const s of subs) {
      try { await send(s, payload); } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(s.endpoint).run();
        else console.error("push failed:", e);
      }
    }
  }
}
