# Security review: branch questie

Scope: `git diff main...questie`, checked against `questie.md`, `questie-plan.md` and `questie-prd.md`. Only verified problems are listed. Items 1 and 2 were reproduced: item 1 by running the server's own `artProblem` on two payloads, item 2 with a vitest run against real Better Auth on a memory DB. The rest were confirmed by reading the code paths end to end.

| # | Severity | Area |
|---|---|---|
| 1 | critical | Stored XSS through course `art` SVG |
| 2 | high | MCP API key gets full account access via `/api/auth/*` |
| 3 | high | Idempotency replay re-runs paid AI work for free |
| 4 | high | Narration: unbounded ElevenLabs spend per unlock |
| 5 | medium | Grader input from user courses is unbounded |
| 6 | medium | Admin approval is not bound to the reviewed version |
| 7 | medium | Account deletion leaves uploads in the Anthropic Files API |
| 8 | medium | `PUT /courses/:id` runs the kata sandbox with no rate limit or kata cap |
| 9 | low | RevenueCat sandbox events grant real credits |
| 10 | low | No body size limit on `/auth/*` and `/webhooks/*` |
| 11 | low | Remote images in course markdown load for every viewer |

---

## 1. critical: stored XSS through course `art` SVG

- Where: `src/course/schema.ts:159` (`artProblem`), `server/courses.ts:120-129` (PUT accepts `art`), `server/courses.ts:75` (`builderProblems` does not reject it), `src/course/registry.ts:91` (`registerCourses` -> `qualifyArt`), `src/screens/Map.tsx:73`, `src/screens/Home.tsx:46`, `src/screens/Library.tsx:59`, `src/engine/Theory.tsx:40` (`dangerouslySetInnerHTML`, no sanitizer).
- Problem: `CourseSchema.art` takes inline SVG strings. The only check is the `artProblem` regex, which blocks `href`, `url(`, `<image`, `<script` and hex colors. It does not block event handlers or `<img>`. A course owner can `PUT /courses/:id` with `art` plus `level.art` pointing at it. The server validates it and stores it. Every client that loads the course runs `registerCourses`, which adds the SVG to the art registry and injects it as raw HTML. Both of these payloads return `null` from `artProblem` (no problem found):
  - `<svg viewBox="0 0 10 10"><foreignObject width="10" height="10"><img src="x" onerror="alert(1)"/></foreignObject></svg>`
  - `<svg viewBox="0 0 1 1"><animate onbegin="alert(1)" attributeName="x" dur="1s"/></svg>`
- Who is hit: anyone who opens a shared link course; every user once the course is public; the admin when it sits in the review queue. The script runs on the app origin. It can call every `/api` route with the victim's cookie: spend credits, read notes and answers, and mint an API key via `/api/auth/api-key/create`, which then leaks session tokens (item 2). On native it can read the bearer token through the app's own client.
- The builder path is not affected: `assemble` (`server/builder.ts:401`) drops `art`. The re-upload path is.
- Fix:
  1. Server: in `builderProblems`, reject user courses that have `art`, any `figure` block, or `level.art` not in `ART_KEYS`. Mirror the existing media-block rule, e.g. `if (c.art && Object.keys(c.art).length) out.push("art: inline art is not allowed")`.
  2. Client: in `registerCourses`, skip `qualifyArt(c)` for runtime courses, since only bundled courses may register SVG. Alternatively, pass runtime SVG through `DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } })` before `addArt`.
  3. Defense in depth: send a `Content-Security-Policy` with `script-src 'self'` from `server/index.ts`. No CSP is set today.

## 2. high: MCP API key gets full account access via `/api/auth/*`

- Where: `server/auth.ts:94` (`apiKey({ enableSessionForAPIKeys: true })`), `server/auth.ts:116-118` (the `/auth/*` handler passes the raw request with `x-api-key`).
- Problem: `sessionFrom` limits `x-api-key` to `GET /notes*`, but the Better Auth handler gets the header unfiltered. The api-key plugin's `before` hook turns the key into a session for every Better Auth endpoint. The plugin sets that session's `createdAt` to now, so it also passes `freshSessionMiddleware`. Reproduced with an MCP key and no cookie:
  - `GET /api/auth/list-sessions` -> 200, returns the user's live session `token`s.
  - `GET /api/me` with `Authorization: Bearer <leaked token>` -> 200 (full account).
  - `POST /api/auth/api-key/create` -> 200 (mints more keys).
  - `POST /api/auth/update-user` -> 200.
  - So a key meant for read-only notes access (it sits in an MCP client config file) gives full account takeover. `delete-user`, `change-password` and `change-email` still refuse it (`sensitiveSessionMiddleware` re-reads the session).
- Fix: strip the header before Better Auth sees it. Sessions for `/notes` come from `auth.api.getSession` in `sessionFrom`, so they are unaffected:
  ```ts
  const h = new Headers(c.req.raw.headers); h.delete("x-api-key");
  return auth.handler(new Request(c.req.raw, { headers: h }));
  ```
  Add to `server/auth.test.ts`: with only `x-api-key`, `/auth/list-sessions` and `/auth/api-key/create` return 401.

## 3. high: idempotency replay re-runs paid AI work for free

- Where: `server/credits.ts:96-100` (replay matches on key and action only; `ref` is ignored), `server/credits.ts:161` (`charge` calls `run()` again on replay), `server/grading.ts:56` and `:112`, `server/narration.ts:155-160`.
- Problem: a reused `Idempotency-Key` with the same action returns `replay: true` and no charge, and the handler then runs again with the new request body:
  - `/grade`: pay 2 credits once, then send any number of different answers or challenges with the same key. Each one is a real Opus grading call. Capped only by the 30/min limit.
  - `/mock`: each replay inserts a new `mock_sessions` row with fresh `grades_left`. Unlimited mock exams for 20 credits.
  - `/narration`: a replay with another `levelId` inserts a new `narration_unlocks` row. Every lesson unlocks for 10 credits.
  - `server/credits.test.ts:150-164` asserts this behavior ("afterwards a replay is free" plus a second 200).
  - `/builder/jobs` is safe: it returns the existing job for the key before calling `spend`.
- Fix:
  - In `spend`, add `prev.ref !== a.ref` to the conflict condition. For `/grade`, make `ref` include a hash of the answer.
  - In `charge`, never call `run()` on replay. Store the successful response body on the spend (new column, e.g. `credit_ledger.result`, written after `run` returns) and return it. Return `409 in_progress` while it is still null.
  - Narration: treat a replay whose unlock insert creates a new row as `409 idempotency_conflict`.
  - Update the test above.

## 4. high: narration has unbounded ElevenLabs spend per unlock

- Where: `server/narration.ts:31-35` (`tracksOf`, no size cap), `server/narration.ts:119-120` (an unlock is per course+level+voice, not per version), `server/narration.ts:152-165`, `shared/narration.ts:39` (`chunks` splits any length, no ceiling).
- Problem: a user course can be up to 2 MB (`PUT /courses/:id`), and all of its theory text is sent to ElevenLabs, which bills per character. A user who owns one course (the free build is enough) pays 10 credits to unlock one level. That first unlock can already be about 2 M characters. After that, every `PUT` with new theory text followed by `POST /narration` finds the level still unlocked and missing tracks, and enqueues a new TTS job at no cost (`spendId` null). The only cap is the 60/h narration rate limit.
- Fix:
  - Cap the narrated characters per level (e.g. 20k summed over `tracksOf`; above that return 400 `too_large`).
  - Bind unlocks to content for user courses: store `version` in `narration_unlocks` and require it to match the current `version` computed in `lesson()`, so an edited lesson needs a new unlock.
  - Optionally cap generated characters per user per day.

## 5. medium: grader input from user courses is unbounded

- Where: `server/grading.ts:27` (`written()` copies `prompt`, `model`, `keyPoints` from the course), `server/grader.ts:40-45` (sent as is to `claude-opus-5-5`).
- Problem: answers are capped at 8000 characters, but the question, model answer and key points come from the course. For a user course the owner sets them up to 2 MB. Each `/grade` (2 credits) or `/answers/:id/improve` (3 credits) can then send hundreds of thousands of input tokens to Opus, 30 times a minute.
- Fix: in `written()`, return 400 when `prompt + model + keyPoints` exceeds a fixed size (reuse `MAX_TEXT` = 20000 from `server/api.ts`). Also add per-field length caps for written challenges in `builderProblems`, so `PUT` rejects them up front.

## 6. medium: admin approval is not bound to the reviewed version

- Where: `server/library.ts:57-73` (`review()` checks only `status = 'pending'`), `server/courses.ts:131-136` (`PUT` keeps `pending` as `pending` and bumps `version`).
- Problem: the owner can replace a pending course's content after the admin opened it and before they click Approve. The swapped version goes public without review. With item 1, that can be a payload shipped to every library user.
- Fix: send the reviewed `version` with approve and reject (`{ version }`), and in `review()` return 409 when `row.version !== version`. The admin client already has `version` in `UserCourseMeta`.

## 7. medium: account deletion leaves uploads in the Anthropic Files API

- Where: `server/account.ts:25` (`purgeUser` deletes `uploads` rows through `OWNED`), `server/builder.ts:428-436` (the sweep finds Files API objects only through those rows), `server/auth.ts:79-82`.
- Problem: files uploaded in the last 24 h (PDFs and notes that may be personal) stay in the Files API forever once the user deletes their account, because nothing references their `file_id` any more. The design promises that deletion removes all user data (questie.md, "Account deletion").
- Fix: in `beforeDelete`, before `purgeUser`, read `SELECT file_id FROM uploads WHERE user_id = ?` and `files.delete` each one (ignore `NotFoundError`). Or have `purgeUser` leave the `uploads` rows so the 24 h sweep still removes the files.

## 8. medium: `PUT /courses/:id` runs the kata sandbox with no rate limit or kata cap

- Where: `server/api.ts:227-235` (no limit on `PUT /courses/:id`), `server/courses.ts:128`, `src/course/validate.ts:25` (two child runs per kata, 5 s each), `server/sandbox.ts:30`.
- Problem: one 2 MB re-upload can hold hundreds of katas. Each spawns two `node --permission` children with up to 5 s and 128 MB each. Runs are sequential per request, but parallel requests are not limited, so one user can keep many children alive at once on the single VPS or Fly machine.
- Fix: add `.put("/courses/:id", limit("course_put", 20, 3600))` next to the other limits. Cap `katas.length` (e.g. 30) in `builderProblems`. Add a small process-wide semaphore (e.g. 4) in `childRunner`.

## 9. low: RevenueCat sandbox events grant real credits

- Where: `server/billing.ts:158-161` (`RcEvent` has no `environment`), `server/billing.ts:231-243`.
- Problem: RevenueCat sends both `SANDBOX` and `PRODUCTION` events to the webhook unless the integration is set to production only. Sandbox purchases (TestFlight builds, license testers) cost nothing, but `rcApply` grants plan and pack credits for them.
- Fix: ignore events with `ev.environment === "SANDBOX"` (log and return 200) unless an env flag such as `REVENUECAT_SANDBOX=1` is set for staging.

## 10. low: no body size limit on `/auth/*` and `/webhooks/*`

- Where: `server/api.ts:221-222` (both mounted before `limitBody`), `server/billing.ts:220` (`c.req.text()` before the signature check).
- Problem: unauthenticated requests can stream bodies of any size into memory before any check runs. `@hono/node-server` sets no default limit.
- Fix: mount `bodyLimit({ maxSize: 256 * 1024, onError: tooLarge })` for `/auth/*` and `/webhooks/*` right after `cors`.

## 11. low: remote images in course markdown load for every viewer

- Where: `src/ui/Md.tsx:9-18`.
- Problem: DOMPurify keeps `<img src="https://...">` by default. A shared or public user course, or text injected from an uploaded source or URL into a built course, can embed tracking images. These log the IP address and timing of every learner who opens the card.
- Fix: in the `afterSanitizeAttributes` hook, remove `img` elements whose `src` is not same-origin or `data:`. Or pass `FORBID_TAGS: ["img"]` when rendering runtime (non-bundled) courses.

---

## Checked, no finding

- Stripe webhook: `constructEvent` with the raw body and secret; event id deduped in the same transaction as the grant; checkout and fulfill share one `(source, source_id)`. `/billing/fulfill` checks the session's `user_id`.
- RevenueCat webhook: constant-time `Authorization` compare; 401 when the secret is unset; unknown users are ignored.
- Origin guard and CORS: cross-site and foreign origins get 403 unless in `APP_ORIGINS`; app-origin requests drop cookies; JSON content type is required on writes, which stops form CSRF; `Origin: null` is rejected.
- IDOR: jobs, answers, improve, notes, uploads and notes used in builds, mock sessions, push devices, and course PUT/DELETE/share/publish are all scoped to the user. Narration audio needs an unlock joined to the hash. Admin routes use `requireAdmin` (verified email in `ADMIN_EMAILS`).
- Uploads: 20 MB body limit, PDF magic bytes or strict UTF-8 text, 500 KB text cap, Files API ids taken only from the caller's rows.
- SSRF: the server never fetches user URLs; `web_fetch` runs at Anthropic with `allowed_domains` set to the given hosts.
- Account linking: Better Auth 1.7 refuses implicit linking when the local email is unverified (`requireLocalEmailVerified` defaults to true), so pre-registering a victim's email does not hijack a later Google or Apple sign-in.
- Markdown, Mermaid, sources: `Md` sanitizes with DOMPurify; Mermaid runs with `securityLevel: "strict"`; source URLs must be http(s) (schema); media blocks are rejected for user courses.
- Kata sandbox: empty env, read access to the child file only, no child processes or workers, heap and time caps. Outbound network from the child is the accepted limit in the plan (wave 1).
- AGPL source link: `src/auth/AccountSection.tsx:45` links the running commit.
- Secrets in logs: nothing logs keys. Auth links are logged only when `RESEND_API_KEY` is unset (the planned self-host fallback).
