-- '' is the unclaimed owner: rows from before multi-user, adopted by the first user to sign in.
ALTER TABLE answers ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE notes ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
CREATE INDEX answers_user ON answers (user_id, challenge_id, created_at);
CREATE INDEX notes_user ON notes (user_id, updated_at);

CREATE TABLE kv_new (
  user_id TEXT NOT NULL DEFAULT '',
  key TEXT NOT NULL,
  value TEXT NOT NULL, -- JSON
  updated_at INTEGER NOT NULL, -- ms epoch, newest wins
  PRIMARY KEY (user_id, key)
);
INSERT INTO kv_new (user_id, key, value, updated_at) SELECT '', key, value, updated_at FROM kv;
DROP TABLE kv;
ALTER TABLE kv_new RENAME TO kv;
