# Questie: codebase map

Map of the current code for `docs/design/questie-plan.md`. Line numbers are at commit `7ac1e9f` (branch `questie`).

Baseline: `npm ci` ok. `npm test`: 34 files, 107 tests, all pass. `npm run typecheck`: clean. `courses-private/` is not present in this checkout.

## 1. Ranked risks

1. **AI-built courses run code on the server.** `validateCourse` (`src/course/validate.ts:6`) runs every kata solution and starter: JS/TS through `new Function` in-process (`src/code/runner.ts:65`), Python through `spawnSync("python3")` (`src/code/runPython.ts:10`). Today only the owner's files reach it. The course builder would feed it model output built from user PDFs/URLs (prompt injection), so it gets the server's fs, env (API keys, Stripe secret) and network. Sandbox it (isolated process with no env/fs/net, or a container) before the builder ships.
2. **Better Auth and webhooks collide with the `auth` and `guard` middleware.** Both are `.use()`d on every `/api` route (`server/api.ts:179-181`).
   - `guard` 403s any request with `sec-fetch-site` other than same-origin/none, for GET as well (`server/api.ts:139-140`), and requires `application/json` on POST/PUT (`:147`). OAuth callbacks are cross-site navigations, and Apple's callback is a cross-site form POST. Mount the Better Auth handler outside `guard`.
   - Stripe and RevenueCat webhooks have no session, so `auth` 401s them. They need the raw body for signature checks and must be mounted before `auth`.
   - Capacitor's webview origin (`capacitor://localhost`, `https://localhost`) fails the origin host check (`:142-146`). It needs an allowlist plus bearer tokens.
   - `bodyLimit` of 256 KB (`:181`) and JSON-only writes block PDF uploads for the builder. Uploads need their own route.
3. **Identity change wipes local progress.** `startSync` (`src/engine/sync.ts:36-42`) compares `/api/me`'s `user` with `localStorage["ql.user"]`. If it differs, `switchUser` deletes the progress key and `ql.kata.*` and reloads (`sync.ts:6-14`). Today `user` is the lowercased proxy email, or `"local"`. If `/me` starts returning a Better Auth user id, every existing browser wipes once. Progress that was never pushed is lost, and before the DB re-key the server has nothing to adopt either. Keep `/me.user` equal to the old key for migrated accounts, or teach `switchUser` the old-to-new mapping.
4. **Docker rename breaks the live deploy.**
   - `DB_PATH=/data/questlog.db` (`Dockerfile:7`, defaults in `server/index.ts:11`, `server/media.ts:9`, `scripts/import-answers.ts:41`). Renaming it boots an empty DB. Keep the file name, or rename it on startup only when the old file exists and the new one does not.
   - The compose project and container name are `questlog` (`docker-compose.yml:3,7`). A new project name starts a second container while the old one keeps `127.0.0.1:8790`, so the port conflicts. Run `docker compose -p questlog down` first.
   - In the deploy workflow, the runner label `questlog` (`.github/workflows/deploy.yml:23`) must be relabelled on the host first, or the job queues forever. `BOX` (`:19`) and `docker logs questlog` (`:43`) also change.
   - The deploy health check sends `x-auth-request-email` (`deploy.yml:40`). Under Better Auth `/api/health` must be public or the deploy fails.
5. **Courses are compiled into the bundle.** `import.meta.glob(..., { eager: true })` (`src/course/registry.ts:51`) runs at build time for the client and for the SSR server bundle (`vite build --ssr`, `package.json` `build:server`). The server gets `COURSES` from that import (`server/api.ts:5,163`). There is no runtime course loading anywhere, and the client reads courses synchronously (see §6). Per-user AI courses need a runtime registry on both sides.
6. **Private-course visibility is cosmetic.** `users` on a course (`src/course/schema.ts:170`) only filters the home list (`registry.ts:58-60`). Course JSON ships in the public bundle, and `/media/:course/:file` is served without auth (`server/media.ts:13`, mounted outside `/api` at `server/index.ts:25`). AI-built private courses must not use this path: keep their JSON in the DB, serve it via `/api`, and gate their media behind auth.
7. **Old import paths in external repos.** `questlog/authoring` is imported by every TS course (`courses/http-basics/*.ts`), by the owner's separate `courses-private` repo (deployed via `deploy.yml:26-29`), and by plugin docs. Keep `questlog/authoring` as a second alias in `tsconfig.json:23` and `vite.config.ts:10` when adding `questie/authoring`.
8. **Credits need atomic DB writes.** The `Db` interface (`server/api.ts:10-16`) has `prepare/bind/first/all/run` only, with no transaction and no `exec`. Spend-with-idempotency needs either one conditional statement (`INSERT ... SELECT ... WHERE balance >= cost` with a UNIQUE idempotency key) or a `transaction()` added to `server/db.ts`. `node:sqlite` is synchronous, so a sync transaction wrapper is safe on one process.
9. **Mock exams have no server side.** `MockScreen` (`src/screens/Mock.tsx:14-35`) picks questions and runs the timer in the browser. It grades through `WrittenAnswer` calling `/api/grade` per question (`src/answers/WrittenAnswer.tsx:110`). A 20-credit mock needs a new server call that debits and issues a mock session id, and `/grade` must not charge again per question inside that session.
10. **One AI call returns both grade and stronger answer.** The grader schema returns `improved` in the same call (`server/grader.ts:20,32`). The plan prices grading (2) and correction/stronger answer (3) separately. Either split into two calls or charge one price. This needs an owner call.

## 2. Every "questlog" occurrence

`git grep -i questlog` (excluding `package-lock.json`). Breakage if renamed:

| Where | What | If renamed |
|---|---|---|
| `package.json:2`, `package-lock.json` | package name | Nothing (private). Update both. |
| `index.html:13,15` | apple title, `<title>` | Cosmetic. Existing iOS home-screen icons keep the old title. |
| `public/manifest.webmanifest:2-3` | PWA name | Installed PWAs pick it up on manifest update. |
| `public/sw.js:2` | `CACHE = "questlog-v1"` | `activate` deletes other caches (`sw.js:6`), so a rename forces one re-fetch. Safe. |
| `public/sw.js:28` | default notification title | Cosmetic. |
| `src/engine/Hud.tsx:48` | brand text | Cosmetic. |
| `src/engine/store.ts:8` | `STORAGE_KEY = "questlog-v1"` (all progress) | **Data loss** without migration. Add a read-old-key fallback in `load()` (`store.ts:153-166`), like `LEGACY_KEY` already does. Also referenced by `sync.ts:11` (wipe list). |
| `src/questie/Questie.tsx:85` | `questlog:questie:<course>` (mascot last stop) | Loses one walk animation. Low. |
| `src/code/highlighter.ts:6,32` | shiki theme name | Internal. Safe. |
| `src/course/authoring.ts:1`, `tsconfig.json:23`, `vite.config.ts:10`, `courses/http-basics/**` (9 imports), plugin docs | `questlog/authoring` import alias | Breaks external course repos (risk 7). Keep both aliases. |
| `vite.config.ts:6`, `scripts/validate.ts:7`, `mcp/courses.ts:13`, `src/course/registry.ts:3` | env `QUESTLOG_COURSES` | Owner's box and MCP configs set it. Read `QUESTIE_COURSES ?? QUESTLOG_COURSES`. |
| `mcp/server.ts:17-26` | env `QUESTLOG_URL`, `QUESTLOG_HEADERS` | User Claude Desktop configs (`mcp/README.md:41-47`). Accept both names. `QUESTLOG_HEADERS` (a proxy header) stops working once the proxy login is dropped. The note tools need a bearer/API token instead. |
| `mcp/server.ts:13,31,117,122` | server name `questlog`, URIs `questlog://schema/course`, `questlog://guide/authoring` | Clients that saved the URIs break. Low. |
| `mcp/server.ts:14,127` | path `plugins/questlog/skills/questlog-course/SKILL.md` | Moves with the plugin rename. Update together. |
| `.mcp.json:3` | MCP server key | Claude Code re-prompts approval. |
| `.claude-plugin/marketplace.json:2,7,11-13`, `plugins/questlog/.claude-plugin/plugin.json` | marketplace + plugin name, source path | Users must re-add and re-install (`README.md:51-52`). Skill namespace changes. |
| `plugins/questlog/skills/questlog-course/` (folder + `name:`) | skill name | Same as above. Skill text references `questlog/authoring` and the `questlog` MCP. |
| `Dockerfile:7`, `server/index.ts:11`, `server/media.ts:9`, `scripts/import-answers.ts:2,41` | `questlog.db` | **Data loss** (risk 4). |
| `docker-compose.yml:3,7` | project/container name | Port conflict on redeploy (risk 4). |
| `.github/workflows/deploy.yml:19,23,43` | box path, runner label, container | Deploy hangs or fails (risk 4). |
| `README.md:1,35,51-52,55,61`, `mcp/README.md` | docs | Docs only. Repo URL `chdominguez/questlog` redirects if the GitHub repo is renamed. |
| `mcp/courses.test.ts:13`, `mcp/media.test.ts:7`, `server/media.test.ts:7` | tmpdir prefixes | Cosmetic. |

Other client storage keys, not named questlog but owned by the app: `ql.user` (`sync.ts:3`, `Home.tsx:15`), `ql.kata.draft.<id>` / `ql.kata.solved.<id>` (`src/code/KataScreen.tsx:16-17`), legacy `entrevista-quest-v2` / `eq2.kata.*` (`src/engine/legacy.ts:5,25`). Leaving the `ql.` prefix as is costs nothing.

## 3. Auth and user identity today

- `Env` (`server/api.ts:18-25`): `USER_HEADER`, `NAME_HEADER`, `LOGOUT_URL`, filled from process env in `server/index.ts:13-15`. Compose sets `USER_HEADER: x-auth-request-email` and `NAME_HEADER: x-auth-request-preferred-username` (`docker-compose.yml:10`).
- `auth` middleware (`server/api.ts:118-124`): user = lowercased header value (max 320 chars, `:115`), or the literal `"local"` when `USER_HEADER` is unset. If the header is missing, it returns 401. It then calls `claimLegacy` on every request (`:127-135`). That adopts rows with `user_id = ''` (from before `0002_users.sql`) for the first user ever seen, once, via a marker row `kv('', 'claimed')`.
- `/me` (`:183-186`) returns `{ user, name?, logout? }`. Callers: `src/engine/sync.ts:36` (the identity switch, risk 3) and `src/screens/Profile.tsx:66-76,118` (email display, name fallback, Sign out link).
- Home reads `ql.user` for course visibility (`src/screens/Home.tsx:15-17`). Profile uses `visibleTo(user)` for reminders (`Profile.tsx:51`).
- Per-user tables, all keyed by `user_id TEXT` = lowercased email or `"local"`:
  - `answers.user_id` and `notes.user_id` (`migrations/0002_users.sql:2-3`)
  - `kv(user_id, key)` with keys `progress`, `profile` and the `''/claimed` marker (`0002_users.sql:7-16`)
  - `push_subscriptions.user_id` and `reminders(user_id, course_id)` (`0003_reminders.sql`)
- Sync: progress is one JSON blob in `kv` (`server/api.ts:269-282`), last-write-wins on `updatedAt`. The client pushes on change with a 2 s debounce, on hide (keepalive), and on load when the server copy isn't adopted (`sync.ts:20-51`).
- Other identity consumers: `scripts/import-answers.ts --user <email>`, the deploy health check header, `mcp/server.ts` `QUESTLOG_HEADERS`, the README deploy section (`README.md:71`), and the `shared/api-types.ts:51,62` comments.
- Tests that encode the proxy model: `server/api.test.ts:30-36` (`USER_HEADER`/`local`), `:193-212` (isolation and first-user claim), `:214-218` (`NAME_HEADER`/`LOGOUT_URL` on `/me`).

Migration to Better Auth (one mode, per the plan):

- Replace the `auth` body with a Better Auth session lookup (cookie or bearer). Keep `c.set("user", ...)` so every route stays unchanged.
- Data re-key: on a user's first sign-in, run `UPDATE <table> SET user_id = :new WHERE user_id = lower(:email)` for `answers`, `notes`, `kv`, `push_subscriptions` and `reminders`. Self-host data stored under `"local"` (and any leftover `''`) goes to the first account created, extending `claimLegacy`.
- The simplest choice is to keep `user_id = lower(email)`: no data migration, and `ql.user` stays the same. The cost is that an email change orphans the data. If keyed by Better Auth id, handle risk 3.
- Delete `USER_HEADER`, `NAME_HEADER` and `LOGOUT_URL` from `Env`, `index.ts` and compose. `/me` returns `name` from the Better Auth user and drops `logout`. Profile then calls the Better Auth sign-out instead of a link.

## 4. Anthropic call sites and credit hooks

The only SDK use is `server/grader.ts`. `claudeGrader` (`:41-65`) builds a client with `maxRetries: 0` and a 90 s timeout (`:39,41`), model `claude-opus-5-5` (`:8`), with server-side fallbacks (`:52-53`), and JSON schema output.

| Feature | Today | Credit hook |
|---|---|---|
| Grading (2) | `POST /api/grade` (`server/api.ts:234-252`). Grader comes from `ANTHROPIC_API_KEY` (`:162`). Failure returns 502 (`:248-251`). Client: `src/answers/api.ts:21-24` (100 s abort), called from `WrittenAnswer.tsx:110`. The client does not retry. | Debit after validation and lookup (`:243`), before `grade()`. Refund in the catch (`:248`). Idempotency key: client-sent per attempt, since the 100 s client abort can retry from the user side. Return 402 before calling the model. `/health` (`:182`) already reports `grader`. Add credits/billing state to `/me`. |
| Correction / stronger answer (3) | Part of the same grade output (`grader.ts:20`). | Risk 10. |
| Mock exam (20) | Client only (`src/screens/Mock.tsx`, `src/answers/mock.ts` `pickMockQuestions`). | New endpoint (risk 9). |
| Notes to course | No AI in the app. It runs in Claude Code via MCP `note_search`/`note_get` (`mcp/server.ts:96-115`) and `course_save` (`:58-68`), on the user's own Claude. | New builder pipeline (150). |
| Topic / files / URL / web course (100/150/200) | Not present. | New: background job table with debit at enqueue and refund on failure. |
| Narration (10) | Not present. | New: cache by `(lesson, voice)` and debit only on a cache miss. |

Test seam: `createApi({ grader })` (`server/api.ts:161-164`) injects a fake grader. All of `server/api.test.ts` relies on it. Reuse the same injection for the builder, narration and billing clients.

## 5. DB schema and migrations

- Mechanism: `openDb` (`server/db.ts:6-21`) creates `_migrations(name)` and applies each `migrations/*.sql` once, sorted by name, each inside BEGIN/COMMIT. It reads `migrations/` relative to **cwd** (`db.ts:9`). That works in Docker (`WORKDIR /app`, `COPY . .`) and in vitest (`memoryDb`, `db.ts:23`). Any new entry point (Litestream wrapper, Capacitor dev server) must start from the repo root.
- Tables: `answers`, `notes`, `kv`, `push_subscriptions`, `reminders` (see §3). All ids are TEXT UUIDs from `crypto.randomUUID()`. Positional `INSERT INTO answers VALUES (...)` (`api.ts:257`) and `INSERT INTO notes VALUES (...)` (`api.ts:301`) depend on column order. Adding a column to those tables breaks both inserts unless they name their columns.
- Migrations needed:
  1. `0004_auth.sql`: Better Auth tables (`user`, `session`, `account`, `verification`). Generate the SQL with the Better Auth CLI and commit it here, so there is one migration path. Do not let Better Auth migrate on its own. Whether Better Auth's adapter accepts `node:sqlite` `DatabaseSync` directly is not checked here. If it doesn't, an adapter over `server/db.ts` is needed.
  2. `0005_credits.sql`: `credit_ledger(id, user_id, delta, reason, ref, idem_key UNIQUE, created_at)` with the balance as `SUM(delta)` or a cached `balances` row; `subscriptions(user_id, provider, external_id, status, period_end)`; `webhook_events(provider, event_id PRIMARY KEY)` for dedupe.
  3. `0006_courses.sql`: `user_courses(id PRIMARY KEY, owner_id, json, status: private|link|pending|public|rejected, created_at, updated_at)` and `course_jobs(id, user_id, kind, input, status, progress, error, course_id, created_at)`.
  4. `0007_narration.sql`: `narrations(lesson_key, voice, path, bytes, created_at, PRIMARY KEY(lesson_key, voice))`.
  5. A data migration re-keying `user_id`, or a runtime claim (see §3).
- Litestream needs a WAL-mode DB. `openDb` does not set `PRAGMA journal_mode=WAL` today. Add it.

## 6. Course storage and per-user AI courses

- Files: `courses/<id>/course.{ts,json}` (public) and `courses-private/<id>/...` (or `QUESTLOG_COURSES`), through the vite alias `@private` (`vite.config.ts:6,10`, `tsconfig.json:26-27,38`).
  - Loaded at build time (`registry.ts:51`), validated with `CourseSchema` (`registry.ts:43`).
  - Ids qualified `<course>:<id>` by `resolve()` (`registry.ts:19-36`).
  - Media rewritten to `/media/<course>/<file>` (`shared/media.ts:28-30`), with files on disk under `mediaRoot()` (`server/media.ts:9`).
- Private courses are deployed by copying the box's `courses-private` into the build (`deploy.yml:26-29`). `.dockerignore` excludes only its `.git`.
- MCP `course_save` (`mcp/server.ts:58-68` to `mcp/courses.ts:37-50`) validates, then writes `<root>/<id>/course.json`. It refuses ids already used by TS courses or the other visibility. The app sees the file only after a rebuild.
- Synchronous consumers of the static registry. All of them must see runtime courses:
  - `src/App.tsx:31` (`courseById`)
  - `src/screens/Level.tsx:38` (`levelByKey`)
  - `src/screens/Review.tsx:18,33,43` (`CHALLENGES`)
  - `src/engine/Challenge.tsx:394` (`courseById` for katas)
  - `src/answers/WrittenAnswer.tsx:45` (`lang`)
  - `src/screens/Home.tsx:17` and `Profile.tsx:51` (`visibleTo`)
  - `server/api.ts:154-159` (`written()` for `/grade`)
  - `src/course/courses.test.ts:6-10` (counts glob modules)
- Proposal for AI-built courses:
  - Store the course JSON (already required to be JSON-serializable, `schema.ts:3`) in `user_courses`.
  - Server: `/grade` looks up `courses` plus the caller's DB courses. Pass a lookup function into `createApi` instead of a static array.
  - `GET /api/courses` returns the user's courses and approved ones. The client runs them through the existing `resolve()` and appends them to `COURSES`/`CHALLENGES` in a `registerCourses()` in `registry.ts` that notifies subscribers. App waits for it before routing to unknown course ids (otherwise `NotFound` flashes).
  - Course ids must be globally unique because progress keys are `<course>:<id>`. Prefix generated ids (e.g. `u<6 chars>-slug`, still matching `COURSE_DIR`, `server/media.ts:11`).
  - Run `validateCourse` in the sandbox (risk 1).
  - Store media under an auth-checked route or with unguessable names.
  - Publishing: status `link` to `pending` to `public` via admin approve. Approved courses could also be exported to `courses/` by a PR for the library.

## 7. PWA, service worker, reminders

- SW registered in production only (`src/main.tsx:9`). It caches the shell and `/assets`, and skips `/api` (`public/sw.js:9-24`). `server/index.ts:20` marks `/sw.js` and the manifest no-cache.
- Push: `src/engine/push.ts` (subscribe with the VAPID key from `/api/push/key`), `server/reminders.ts` (`runReminders` every 60 s when the three VAPID vars are set, `server/index.ts:38-42`). The payload links to `/#/c/<course>` (`reminders.ts:41`). Dead subscriptions are dropped on 404/410.
- Capacitor: the SW and Web Push don't run in the iOS/Android webviews. Mobile reminders need native push (FCM/APNs), a second sender beside `webPushSend`, and a `device_tokens` table. `push.ts:12` already returns `"unsupported"`, so the web UI degrades. All client fetches use relative `/api` paths (`src/answers/api.ts:8,34,43-44,47`, `src/engine/sync.ts:21,36,39`), so Capacitor needs an API base URL.
- README requires the proxy to skip login for the manifest, `sw.js` and icons (`README.md:71`). With in-app auth that note goes away, but `/api/health` and the asset paths must stay public.

## 8. Tests and CI

- Vitest config is inline in `vite.config.ts:12` (node env, includes src/server/shared/scripts/mcp). Playwright is a dev dependency with no specs in the repo.
- `.github/workflows/ci.yml`: on pull_request, it runs `npm ci`, `tsc`, `npm test` and `npm run build`. It does not run `npm run validate`. The plan's community course PRs need `npm run validate` (and later the site build) added here.
- `.github/workflows/deploy.yml`: on push to main, a self-hosted runner tests, builds the compose stack and health-checks (risk 4).
- Tests to update:
  - `server/api.test.ts:30-36,193-218`: proxy header, `local`, `NAME_HEADER`/`LOGOUT_URL` on `/me`. Rewrite them for session auth, keep the isolation and claim assertions, and add tests for 402 and refund-on-502 on `/grade`.
  - `src/engine/sync.test.ts`: covers adopt/debounce/flush only. Nothing tests the `switchUser` wipe. Add tests for it, including the old-id-to-new-id case.
  - `src/engine/store.test.ts`: add the old `questlog-v1` key migration.
  - `src/course/courses.test.ts:109-114`: `visibleTo`, if `users` is replaced by DB courses.
  - `mcp/courses.test.ts`: if env names or roots change.
  - New tests: credits ledger (idempotent spend, monthly grant, refund), webhook dedupe and signature, `user_courses` access (owner-only, link, public), builder pipeline with a fake model, sandboxed validate.

## 9. Order of work this implies

1. Rename with data-preserving shims: `STORAGE_KEY` fallback, keep `questlog.db`, both env names, both import aliases, compose `down` of the old project.
2. Better Auth mounted outside `guard`/`auth`, user re-key, `/me` compatibility, Profile sign-out, health public.
3. Ledger plus Stripe/RevenueCat webhooks outside auth, then `/grade` metering.
4. Runtime course registry plus `user_courses`, then the sandboxed builder.
5. Narration, publishing queue, site, Capacitor.
