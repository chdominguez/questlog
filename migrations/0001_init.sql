CREATE TABLE answers (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  level_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  answer TEXT NOT NULL,
  source TEXT NOT NULL,
  seconds INTEGER,
  grade TEXT, -- JSON Grade
  self_score INTEGER,
  created_at TEXT NOT NULL -- ISO
);
CREATE INDEX answers_challenge ON answers (challenge_id, created_at);

CREATE TABLE kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL, -- JSON
  updated_at INTEGER NOT NULL -- ms epoch, newest wins
);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL, -- Markdown
  tags TEXT NOT NULL DEFAULT '[]', -- JSON string[]
  course_id TEXT,
  created_at TEXT NOT NULL, -- ISO
  updated_at TEXT NOT NULL -- ISO
);
CREATE INDEX notes_updated ON notes (updated_at);
