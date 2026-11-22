CREATE TABLE flags (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, course_id TEXT NOT NULL, item_id TEXT, reason TEXT NOT NULL, text TEXT, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL);
CREATE INDEX flags_open ON flags (status, created_at);
