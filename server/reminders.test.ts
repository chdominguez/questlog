import { expect, test } from "vitest";
import { memoryDb } from "./db";
import { dueDate, runReminders } from "./reminders";

test("dueDate: local time in the zone, 5 minute window, once per local day", () => {
  const t = new Date("2026-11-15T07:02:00Z"); // 08:02 in Madrid (CET)
  expect(dueDate(t, "Europe/Madrid", "08:00", "")).toBe("2026-11-15");
  expect(dueDate(t, "Europe/Madrid", "08:00", "2026-11-15")).toBeNull();
  expect(dueDate(t, "Europe/Madrid", "08:03", "")).toBeNull(); // not yet
  expect(dueDate(new Date("2026-11-15T07:06:00Z"), "Europe/Madrid", "08:00", "")).toBeNull(); // window passed
  expect(dueDate(t, "UTC", "08:00", "")).toBeNull();
  expect(dueDate(new Date("2026-11-15T23:30:00Z"), "Asia/Tokyo", "08:30", "")).toBe("2026-11-16"); // next day locally
});

test("runReminders sends once, and drops subscriptions the push service reports gone", async () => {
  const db = memoryDb();
  await db.prepare("INSERT INTO reminders (user_id, course_id, title, time, tz) VALUES ('u', 'c', 'Course', '08:00', 'UTC')").run();
  await db.prepare("INSERT INTO push_subscriptions VALUES ('live', 'u', 'k', 'a'), ('dead', 'u', 'k', 'a')").run();
  const sent: string[] = [];
  const send = async (s: { endpoint: string }, payload: string) => {
    if (s.endpoint === "dead") throw Object.assign(new Error("gone"), { statusCode: 410 });
    sent.push(payload);
  };
  const now = new Date("2026-11-15T08:01:00Z");
  await runReminders(db, { web: send }, now);
  await runReminders(db, { web: send }, now);
  expect(sent).toHaveLength(1);
  expect(JSON.parse(sent[0])).toMatchObject({ title: "Course", url: "/#/c/c" });
  expect((await db.prepare("SELECT endpoint FROM push_subscriptions").all()).results).toEqual([{ endpoint: "live" }]);
});

test("runReminders sends to web and native devices, and drops tokens FCM reports unregistered", async () => {
  const db = memoryDb();
  await db.prepare("INSERT INTO reminders (user_id, course_id, title, time, tz) VALUES ('u', 'c', 'Course', '08:00', 'UTC')").run();
  await db.prepare("INSERT INTO push_subscriptions VALUES ('web', 'u', 'k', 'a')").run();
  await db.prepare("INSERT INTO device_tokens VALUES ('live', 'u', 'android', ''), ('dead', 'u', 'ios', ''), ('other', 'v', 'ios', '')").run();
  const web: string[] = [];
  const native: [string, object][] = [];
  await runReminders(db, {
    web: async (_s, payload) => { web.push(payload); },
    fcm: async (token, m) => { native.push([token, m]); return token === "dead" ? "gone" : "ok"; },
  }, new Date("2026-11-15T08:01:00Z"));
  expect(web).toHaveLength(1);
  expect(native.sort()).toEqual([
    ["dead", { title: "Course", body: "Time to study", url: "/#/c/c" }],
    ["live", { title: "Course", body: "Time to study", url: "/#/c/c" }],
  ]);
  expect((await db.prepare("SELECT token FROM device_tokens ORDER BY token").all()).results).toEqual([{ token: "live" }, { token: "other" }]);
});
