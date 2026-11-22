CREATE TABLE mock_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, course_id TEXT NOT NULL, spend_id TEXT, grades_left INTEGER NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE narration_audio (hash TEXT PRIMARY KEY, voice TEXT NOT NULL, chars INTEGER NOT NULL, bytes INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE narration_tracks (course_id TEXT NOT NULL, version TEXT NOT NULL, level_id TEXT NOT NULL, voice TEXT NOT NULL, card INTEGER NOT NULL, hash TEXT NOT NULL, PRIMARY KEY (course_id, version, level_id, voice, card));
CREATE TABLE narration_unlocks (user_id TEXT NOT NULL, course_id TEXT NOT NULL, level_id TEXT NOT NULL, voice TEXT NOT NULL, spend_id TEXT, created_at TEXT NOT NULL, PRIMARY KEY (user_id, course_id, level_id, voice));
