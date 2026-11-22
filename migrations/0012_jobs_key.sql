-- Build key and mode in their own columns: job lists and the retry lookup no longer parse jobs.input.
ALTER TABLE jobs ADD COLUMN idem_key TEXT;
ALTER TABLE jobs ADD COLUMN mode TEXT;
UPDATE jobs SET idem_key = json_extract(input, '$.key'), mode = json_extract(input, '$.mode') WHERE kind = 'build';
CREATE INDEX jobs_key ON jobs (user_id, idem_key) WHERE idem_key IS NOT NULL;
