CREATE TABLE user_courses (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL,
  title TEXT NOT NULL, lang TEXT NOT NULL, summary TEXT,
  json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'private',   -- CourseStatus
  mode TEXT NOT NULL,                       -- CourseMode
  levels INTEGER NOT NULL, sources INTEGER NOT NULL DEFAULT 0,
  source_job_id TEXT, review_note TEXT, reviewed_by TEXT, reviewed_at TEXT, published_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX user_courses_owner ON user_courses (owner_id, updated_at);
CREATE INDEX user_courses_status ON user_courses (status, published_at);
CREATE TABLE course_opens (user_id TEXT NOT NULL, course_id TEXT NOT NULL, opened_at TEXT NOT NULL, PRIMARY KEY (user_id, course_id));
