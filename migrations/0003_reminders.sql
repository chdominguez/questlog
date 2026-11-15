CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL
);
CREATE INDEX push_user ON push_subscriptions (user_id);

CREATE TABLE reminders (
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  title TEXT NOT NULL,
  time TEXT NOT NULL, -- 'HH:MM' in tz
  tz TEXT NOT NULL, -- IANA zone of the device that set it
  last_sent TEXT NOT NULL DEFAULT '', -- local date 'YYYY-MM-DD' of the last send
  PRIMARY KEY (user_id, course_id)
);
