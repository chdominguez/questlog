CREATE TABLE device_tokens (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, platform TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX device_tokens_user ON device_tokens (user_id);
