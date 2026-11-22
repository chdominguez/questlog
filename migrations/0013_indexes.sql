-- Lookups that scanned whole tables inside write transactions.
CREATE INDEX course_opens_course ON course_opens (course_id);
CREATE INDEX credit_ledger_ref ON credit_ledger (ref) WHERE ref IS NOT NULL;
CREATE INDEX uploads_user ON uploads (user_id);
CREATE INDEX mock_sessions_user ON mock_sessions (user_id);
CREATE INDEX flags_user ON flags (user_id);
