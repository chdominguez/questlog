# Questie performance review

Branch `questie` vs `main` (`git diff main...questie`), checked against `questie.md`, `questie-plan.md` and `questie-prd.md`. Code was not changed.

## Measurements

| What | Result |
|---|---|
| Web main chunk (`vite build`) | main 647 KB min / 197 KB gzip, questie 787 KB / 241 KB (+140 KB / +43 KB, +22%) |
| Main chunk without the Better Auth client (stubbed in a scratch copy) | 761 KB / 231 KB, so the auth client costs 26 KB / 10 KB |
| Native plugins on web | `firebase`, `@capacitor-firebase/*`, `@capgo/*`, `@revenuecat/*`, secure storage, native settings: all in lazy chunks. Only `@capacitor/core` (26 KB) is preloaded. OK |
| Commit cost, WAL, `synchronous=FULL` (the current default) vs `NORMAL` | 2.06 ms vs 0.05 ms per write transaction (local NVMe, 300 commits) |
| `GET /courses`, 20 courses x 150 KB JSON | `c.*` 3.2 ms vs meta columns only 1.0 ms |
| `course_opens` lookup by `course_id`, 200k rows | 0.35 ms scan vs 0.01 ms with an index |
| `credit_ledger` `kind/ref` lookup, 1M rows | 64 ms full scan, warm cache |
| Zod parse of a 43 KB course | 0.56 ms (registry loading is fine) |
| Landing page | 92 KB CSS, two small scripts, responsive WebP; one finding below |

Query plans (`EXPLAIN QUERY PLAN` on the migrated schema): the job claim, the job list, the ledger by user, the course list, the audio unlock check and push lookups all use indexes. Full scans: `course_opens` by `course_id`, `credit_ledger` by `kind/ref`, `uploads`/`mock_sessions`/`flags` by `user_id`.

## Findings

### 1. High: build jobs block narration jobs; the narration player gives up after 5 minutes

- `server/jobs.ts:110-114`, `src/narration/Narration.tsx:21`, `server/env.ts:89`
- **Problem:** one FIFO queue (`ORDER BY created_at`) and `JOB_CONCURRENCY` defaults to 2. A build runs several Sonnet calls with `max_tokens: 64000`, a write pool, and a fix loop of up to 3 rounds, so it takes minutes. With two builds running (two users), every narration job waits behind them. The player polls for `POLL_MAX * POLL_MS` = 5 minutes, then shows "failed" with `refunded=false`. The job is still queued and the unlock is already charged. Narration is the job a user is actively waiting on.
- **Fix:** claim narration first: `ORDER BY kind = 'build', created_at, rowid` in the claim subquery. Also keep one slot that builds cannot take: when `active >= JOB_CONCURRENCY - 1`, claim only `kind = 'narration'`, or count builds and narration separately. Before showing "failed", check `GET /jobs/:id` instead of relying on a fixed 5-minute limit.

### 2. Medium: every write transaction fsyncs and blocks the event loop

- `server/db.ts:19`
- **Problem:** `openDb` sets WAL but leaves `synchronous` at the default `FULL` (checked: `PRAGMA synchronous` returns 2). `node:sqlite` is synchronous, so every commit holds the event loop for one fsync: 2 ms on local NVMe, and more on Fly volumes. This affects every spend, ledger row, job event (`emit`), heartbeat, progress sync and kv write. Litestream's guidance for WAL is `synchronous=NORMAL`.
- **Fix:** add `PRAGMA synchronous = NORMAL;` to the `openDb` pragma line. Measured cost per commit drops 40x (0.05 ms). With WAL the database stays consistent. Only the last commits before an OS crash or power loss can be lost, not a process crash, and Litestream already replicates.

### 3. Medium: new screens and the Better Auth client are all in the main chunk

- `src/App.tsx:21-31`, `src/auth/client.ts:1-3` (imported statically by `src/auth/SignInScreen.tsx`, `SignUpScreen.tsx`, `ForgotScreen.tsx`, `ResetScreen.tsx`, `VerifyScreen.tsx`, `parts.tsx`, `AccountSection.tsx`)
- **Problem:** the main chunk grew +140 KB min / +43 KB gzip over `main`. Builder, job, queue, plans, credits, billing-done, library and welcome screens are imported statically. A signed-in learner opening a lesson downloads and parses all of them. The Better Auth client (26 KB / 10 KB) only serves sign-in, sign-up and the API-key button. `session.ts` already imports it with `import()`.
- **Fix:** use `React.lazy` + `Suspense` for `BuildScreen`, `JobScreen`, `QueueScreen`, `PlansScreen`, `CreditsScreen`, `BillingDoneScreen`, `LibraryScreen`, `WelcomeScreen` and the auth screens in `App.tsx`. In `parts.tsx` and `AccountSection.tsx`, call `(await import("./client")).authClient` inside the handlers.

### 4. Medium: build inputs with note bodies are read and parsed on every job poll

- `server/builder.ts:24`, `server/builder.ts:143-146`, `server/builder.ts:130`, `server/builder.ts:167-171`, `server/jobs.ts:72`, `src/builder/JobCards.tsx:24,30`
- **Problem:** a files-mode build copies up to 50 full note bodies into `jobs.input`. A note can be up to the 256 KB body limit, so one row can reach about 12 MB. Several paths then read and parse that column:
  - `GET /jobs` runs `SELECT *` over up to 20 rows, and `toJob` runs `JSON.parse(r.input)` on each one only to read `mode`.
  - `POST /builder/jobs` runs `json_extract(input, '$.key')`, which parses the input of every past build the user has.
  - Home (`JobCards`) calls `GET /jobs` plus `GET /jobs/:id` with no `after` every 3 s while a build runs. That replays all events each time, and each call also runs `balance()` in a transaction.
- **Fix:**
  - Store `mode` and the idempotency key in their own columns, or in a small `meta` JSON, and select only the columns that `toJob` needs.
  - Look up the retry key with an indexed column, for example a `UNIQUE (user_id, idem_key)` key. The ledger already enforces `UNIQUE(source, source_id)`, so a single `SELECT ... FROM credit_ledger WHERE source='spend' AND source_id = user:key` also works.
  - In `JobCards`, keep the last `seq` per job and pass `after`, the same way `JobScreen` does.

### 5. Medium: the reminder sweep can overlap itself and send duplicates; the FCM fetch has no timeout

- `server/reminders.ts:37-66`, `server/reminders.ts:76`, `server/fcm.ts:44`
- **Problem:** `setInterval(..., 60_000)` starts a new `runReminders` even when the last one is still running. Each run reads every reminder, then sends web push and FCM to each due user one at a time. Reminders cluster on round times (09:00), so a run with a few hundred due users and a slow push endpoint takes longer than 60 s. The next run reads rows that the first run has not yet marked with `last_sent` and sends them again. The new FCM `fetch` has no `signal`, so one hung connection stalls the whole sweep.
- **Fix:** guard with a `running` flag, or chain `setTimeout` after the run finishes. Select only due rows (or mark `last_sent` for all due rows in one `tx` before sending). Add `signal: AbortSignal.timeout(10_000)` to both FCM fetches. Send to a user's devices with `Promise.allSettled`.

### 6. Low: missing indexes cause full scans inside write transactions

- `migrations/0006_courses.sql:13`, `server/courses.ts:144`, `server/account.ts:21,25`, `server/billing.ts:116,119`, `migrations/0007_jobs.sql:12-13`, `migrations/0009_library.sql:1`
- **Problem:** these scans run inside `BEGIN IMMEDIATE`, so they hold the write lock and the event loop while they run:
  - `DELETE FROM course_opens WHERE course_id = ?` (course delete and account purge) scans the table, because the PK is `(user_id, course_id)`.
  - The `charge.refunded` webhook sums `credit_ledger WHERE kind = 'stripe_refund' AND ref = ?`, a full scan of the fastest-growing table (64 ms at 1M rows). The checkout lookup by `ref` walks every `stripe_checkout` row.
  - `purgeUser` deletes from `uploads`, `mock_sessions` and `flags` by `user_id`, all without an index. `mock_sessions` and `job_events` are never pruned.
- **Fix:** add a `0011` migration with these indexes:
  - `CREATE INDEX course_opens_course ON course_opens (course_id);`
  - `CREATE INDEX credit_ledger_ref ON credit_ledger (ref) WHERE ref IS NOT NULL;`
  - `CREATE INDEX uploads_user ON uploads (user_id);`
  - `CREATE INDEX mock_sessions_user ON mock_sessions (user_id);`
  - `CREATE INDEX flags_user ON flags (user_id);`

  Add a sweep that deletes expired `mock_sessions`.

### 7. Low: course list and course lookup read the full course JSON they do not use

- `server/courses.ts:18`, `server/courses.ts:43`, `server/courses.ts:101-104`
- **Problem:** `COURSE_SELECT` is `SELECT c.*`. `GET /courses` returns only metadata but reads every course's JSON blob, which can be up to 2 MB each: 3.2 ms vs 1.0 ms for 20 x 150 KB. `findCourse` (on every grade, mock and narration request for a user course) reads the blob even when the parsed course is already in the `id@version` cache.
- **Fix:** use the explicit column list from `library.ts` `META` for `GET /courses`. In `findCourse`, select `owner_id, status, version` first and read `json` only on a cache miss.

### 8. Low: narration waits for the whole lesson and plays from a full download on native

- `server/narration.ts:87`, `src/narration/Narration.tsx:19,47`, `src/narration/api.ts:17-23`
- **Problem:** the job makes tracks one at a time, and the player stays in "preparing" until every track is ready (`allReady`). Time to first sound is therefore the whole lesson's TTS time. On iOS and Android, `audioSrc` downloads each segment to a blob before `play()`, so a 3-minute card (about 3 MB at 128 kbps) must download fully before it starts. The blob is revoked on every card change, so going back fetches it again.
- **Fix:** mark the lesson playable when `tracks[card].ready`, keep polling for the rest, and generate tracks with a small pool (2-3). On native, keep blob URLs per hash for the lesson's lifetime instead of revoking them on each card change.

### 9. Low: the heartbeat is written every 15 s but never read

- `server/jobs.ts:92-94`
- **Problem:** `heartbeat_at` is not read anywhere: boot recovery uses only `status = 'running'`. That is four fsync'd commits per minute per running job (see finding 2), plus Litestream WAL churn, with no reader.
- **Fix:** drop the interval. Or use it: on boot or in the hourly sweep, requeue or fail `running` jobs whose `heartbeat_at` is older than 2 minutes. That is the "heartbeat recovery" the WP5 tests name.

### 10. Low: the landing hero downloads both theme variants of the screenshot

- `site/src/components/Hero.astro:30-31`
- **Problem:** both the light and dark map shots are `loading="eager"`. Eager images download even when hidden with CSS, so every visitor fetches the unused variant (12-30 KB) on the critical path, alongside the LCP image.
- **Fix:** set `loading="lazy"` on the dark variant, or both, and keep `fetchpriority="high"` on the light one. Lazy images that are `display: none` are not fetched.

## Checked, no problem found

- Job claim is atomic (`UPDATE ... WHERE id = (SELECT ... LIMIT 1) RETURNING`) and uses `jobs_queue`. `db.tx` is sync, so no transaction spans an `await`. Better Auth runs with `transaction: false` on the shared connection.
- Narration audio: `serveFile` streams with `createReadStream`, supports Range and ETag/304, and sends `Cache-Control: private, max-age=31536000, immutable`. The unlock check uses indexes. Single-flight plus temp-file-and-rename prevents duplicate TTS within one process.
- `firebase` and the Capacitor plugins are not loaded on web.
- Registry loading caches courses in localStorage by version and fetches only changed course JSON. Zod parse cost is small.
- Builder kata checks run in a child process and the ElevenLabs fetch has a 120 s timeout.
