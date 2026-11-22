CREATE TABLE jobs (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  kind TEXT NOT NULL,                       -- build | narration
  status TEXT NOT NULL,                     -- queued | running | done | failed
  title TEXT, input TEXT NOT NULL, result TEXT, error TEXT,
  spend_id TEXT, attempts INTEGER NOT NULL DEFAULT 0, usage TEXT,
  created_at TEXT NOT NULL, started_at TEXT, heartbeat_at TEXT, finished_at TEXT
);
CREATE INDEX jobs_queue ON jobs (status, created_at);
CREATE INDEX jobs_user ON jobs (user_id, created_at);
CREATE TABLE job_events (job_id TEXT NOT NULL, seq INTEGER NOT NULL, at TEXT NOT NULL, type TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (job_id, seq));
CREATE TABLE uploads (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, file_id TEXT NOT NULL, name TEXT NOT NULL, bytes INTEGER NOT NULL, job_id TEXT, created_at TEXT NOT NULL);
