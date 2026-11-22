# Questie: build contract and work packages

The single source for the implementation. It merges `questie-plan.md` (final), `questie-prd.md`, `questie-ux.md`, `questie-backend.md`, `questie-frontend.md`, `questie-site.md` and `questie-codebase.md`. Where they disagree, this file decides (section 1). Engineers build from this file; the other designs are background for detail this file does not repeat (prompts, copy tables, wireframes).

Written 2026-11-22 against branch `questie` at `75c302a`. Baseline: Node 24.19, 34 test files, 107 tests green.

Precedence: plan decisions > facts in the research reports > this file > the other designs.

## 1. Conflicts resolved

| Topic | Designs said | Decision | Why |
|---|---|---|---|
| Builder routes | backend `POST /api/builder/jobs`, `/api/builder/uploads`; frontend `/api/jobs`, `/api/uploads`; UX `/api/build`, `GET /api/build/:job` | backend names; jobs read at `GET /api/jobs/:id` | Backend owns the server; frontend said backend wins |
| Build start response | backend `202 { jobId }`; frontend `201 { job }` | `202 { jobId }` | Same |
| Stronger answer | backend `POST /api/grade/improve { challengeId, answer, grade }`; frontend `POST /api/answers/:id/improve` | `POST /api/answers/:id/improve` | UX needs the result saved with the attempt; server reads the saved answer and grade instead of trusting the client copy |
| Mock id | backend `mockId`; frontend `mockSession` / `{ session }` | `mockId` | Backend names |
| Narration routes | backend per-card tracks `GET /api/narration/:course/:level`, `POST /api/narration`, `GET /api/narration/audio/:hash`; frontend one URL per level | backend | UX plays one segment per card |
| Stripe return | backend `/#/profile?checkout=`; frontend `/?checkout=#/profile`; UX `/?session_id=#/billing/done` + `GET /api/billing/session/:id` | `success_url = ${APP_URL}/?session_id={CHECKOUT_SESSION_ID}#/billing/done`, `POST /api/billing/fulfill { sessionId }` | Query before the hash (frontend fact: no template inside a fragment); UX screen; POST because it writes |
| Checkout items | backend `plan \| pack_s \| pack_l`; frontend `topup-s \| topup-l` | `plan \| pack_s \| pack_l` | Backend names |
| Admin routes | backend `GET /api/admin/review` + approve/reject; frontend `GET /api/admin/queue`, `POST /api/admin/courses/:id` | backend | Backend names |
| Unpublish target | backend `-> private`; frontend `-> link` | `-> private` | UX "Make private" |
| Course list | backend own + public; frontend own + opened by link | own + opened by link + nothing else; library is `GET /api/library` | Frontend fact: link courses must come back on a second device |
| Build cancel | backend cancel while queued | none | Plan wave 1: no cancel in v1 |
| Active builds | backend 2 per user | 1 build per user (`429 job_limit`) | Plan wave 1 |
| Uploads | backend 5 per job; UX 10 x 20 MB | 10 files x 20 MB, text files 500 KB | Plan wave 1 |
| Low balance | backend 50; UX 100 | 100 | Plan wave 1 |
| Vague topic | backend outline `reject` after debit (refunded); UX/frontend pre-check, `422 { suggestions }` | sync pre-check inside `POST /api/builder/jobs` before any debit (`422 topic_too_broad`); outline `reject` stays as a backstop with refund | PRD BLD-10 "before credits are spent" |
| URL/repo pre-check | UX "Couldn't fetch this URL", "Repo not public" before build | no server fetch; fetch errors fail the job with refund (`source_unreachable`) | Backend fact: Anthropic web fetch does the request, our server never fetches user URLs (no SSRF) |
| Pricing module | backend `shared/pricing.ts`; frontend costs from `/me` | `shared/pricing.ts` is the only config; server, site import it; the app shows costs from `me.credits.costs` | One config (CRD-6); old mobile builds never show stale costs |
| Cost keys | backend `course_topic, course_files, course_web, grade, improve, mock, narration`; frontend `topic, files, research` | backend keys | Backend names |
| Stripe price ids | backend lookup keys in `pricing.ts`; site `STRIPE_PRICE_*` env | lookup keys, no env | One config; `scripts/stripe-setup.ts` creates them |
| RevenueCat product ids | backend `questie_plan_monthly`; site `questie.plan.monthly` | site ids (`questie.plan.monthly`, `questie.credits.500`, `questie.credits.1500`); plan also matches `questie.plan.monthly:monthly` (Play base plan id as RC reports it) | Site owns store setup |
| Public URL env | backend `APP_URL`; site `BETTER_AUTH_URL` | `APP_URL` | Also used for Stripe redirects |
| Apple env | backend team/key/private key, secret made at boot; site `APPLE_CLIENT_SECRET`, `APPLE_APP_BUNDLE_ID` | backend (`APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY, APPLE_BUNDLE_ID`) | Secret expires in 6 months; regenerated each boot |
| Mail env | site left open | `RESEND_API_KEY`, `EMAIL_FROM` | Plan wave 1: Resend via fetch |
| Litestream env | backend `LITESTREAM_REPLICA_URL`; site `LITESTREAM_BUCKET/PATH/ENDPOINT/REGION` | site bucket form; `LITESTREAM_BUCKET` set = replication on | Matches Tigris/R2 setup (region `auto`) |
| Start script | backend `scripts/start.sh`; site `scripts/entrypoint.sh` | `scripts/entrypoint.sh` as `ENTRYPOINT` | Ops owner |
| `DB_PATH` | both keep `questlog.db` | default `data/questlog.db`, image `/data/questlog.db`; never renamed | REN-3, live deploy |
| API base | frontend `src/platform.ts` `API_BASE`; site `src/native/platform.ts` `apiUrl()` | `src/platform.ts` exports `isNative, platform, isDemo, API_BASE, apiUrl(path)`; `VITE_API_BASE` is the only build var; native-only code in `src/native/` | One file every client fetch imports; native plugins stay out of the web bundle |
| Native flag | site `VITE_NATIVE=1`; frontend `Capacitor.isNativePlatform()` | runtime `Capacitor.isNativePlatform()`, no `VITE_NATIVE` | No second build flag to forget |
| Native push plugin | frontend `@capacitor/push-notifications`; site `@capacitor-firebase/messaging` | `@capacitor-firebase/messaging` | Server has one FCM sender for both platforms |
| `/me` shape | backend `{ user, name, email, admin, aliases, credits: { metered, total } }`; frontend `features: { billing, narration, builder }`, costs; UX flags `billing, ai, narration, admin, native`, `lowWarned` | `Me` in 3.2: `features: { ai, billing, narration }`, `admin`, `aliases`, full `credits` or `null` | `builder` = `ai`; `native` is a client fact, not a server flag |
| Identity switch | backend `/me.aliases`; frontend `prev === email \|\| "local"` | keep data when `prev` is in `me.aliases` or equals `lower(me.email)` | `local` only maps for the first account, which the server knows |
| 402 body | backend `{ need, balance, action }`; frontend `{ cost, balance }` | `{ error, code: "insufficient_credits", action, cost, balance }` | Client reads `cost` |
| Balance updates | frontend `x-credits-balance` header; backend none | every metered response and job poll sets `x-credits-balance` when billing is on; CORS exposes it | One update path for the chip |
| Routes (client) | UX `#/signin, #/signup, #/verify, #/forgot, #/reset/:token, #/admin/review`, ...; frontend gate-rendered AuthScreen, `#/reset`, `#/admin` | UX routes, except reset is `#/reset` with the token read from the query | Better Auth appends `?token=` to the callback URL |
| Onboarding / low-balance seen | UX server-side flags | `localStorage` (`ql.welcomed.<user>`, `ql.lowWarned`) | No server state for a hint |
| Approve undo | UX `Undo` for 5 s | client waits 5 s before sending approve | No unapprove endpoint |
| Compose / runner | site keeps `questlog`; PRD REN-4 rename with old project down | compose project and container renamed `questie` with `docker compose -p questlog down` before `up`; runner label stays `questlog` | Runner label changes only after the owner relabels the host |
| CI for site/mobile | site adds jobs to `ci.yml` | own workflows `site.yml`, `mobile.yml` | Disjoint files for parallel work |
| mock_sessions / flags tables | backend in `0007_jobs` / `0006_courses` | own migrations owned by the WP that uses them | One owner per migration file |

## 2. Deviations from plan and PRD

| Item | Plan / PRD | This build | Reason |
|---|---|---|---|
| REN-4 runner relabel | relabel and update the workflow | label `questlog` kept; runbook step for the owner | Relabel is a host action; changing the workflow first queues the job forever |
| UX "No text found" for PDFs | server extracts text | not shown; unreadable files fail the build with refund | Files go to the Anthropic Files API; the server never parses PDFs |
| URL/repo pre-check (UX 5.1) | before the build | job fails with `source_unreachable` and refund | No server-side fetch (SSRF) |
| Python katas (BLD-4) | sandboxed check | static check on the server, run client-side via Pyodide | Plan wave 1 accepted |
| TS kata sandbox network | isolated | outbound network still possible | Plan wave 1 accepted; code comment `shortcut:` |
| Web-research builds | 200 credits | fail with refund when fewer than 3 distinct sources | Citations gate (PRD launch gate) |
| BLD-12 stable ids on rebuild | Should | ids kept on re-upload (`PUT /courses/:id`); no "rebuild" action in v1 | No rebuild flow designed |
| BLD-13 eval harness | Should | `scripts/builder-eval.ts`, run by hand with a real key, not in CI | Costs money per run |
| X-3 screen-reader path for timed games | Should | not in this effort | No design exists; AI features never depend on timed play |
| MOB lock-screen controls | UX: Media Session | Media Session metadata set on web; native lock screen not guaranteed | WebView support varies; background audio mode is set |
| CRD-12 cost-change notice | Should | `CREDITS_NOTICE` env text in `me.credits.notice` | Smallest path |
| Copy "12 challenge types" | plan | "11 challenge types plus drills and arcade games" | Site counted `ChallengeSchema` |
| Account deletion | UX open point | deletes all user rows, their courses (public ones too), ledger; cancels Stripe plan now | Plan wave 1 default |
| NOTICE trademark paragraph | site recommendation | included; owner can drop it in review | Not blocking |

## 3. Interface contract

### 3.1 HTTP conventions

- Base path `/api`. JSON in and out, except `POST /builder/uploads` (multipart) and `GET /narration/audio/:hash` (audio).
- Every error: `{ error: string, code: ErrorCode, ...extra }`. `error` is human text (existing clients read it); `code` is stable.
- Writes that spend credits take `Idempotency-Key: <uuid>`. The client makes one key per user action and reuses it on a retry of that action.
- Metered responses (success or refund) carry `x-credits-balance: <total>` when billing is on.
- Auth: cookie `questie.session_token` on web; `Authorization: Bearer <token>` on native. Requests from an `APP_ORIGINS` origin are bearer-only (cookies stripped).
- CORS: origins `APP_ORIGINS`; allow headers `Authorization, Content-Type, Idempotency-Key`; expose `set-auth-token, x-credits-balance, Retry-After`; `maxAge` 600.
- Body limits: 256 KB; `POST /builder/uploads` 20 MB; `PUT /courses/:id` 2 MB.

Mount order in `server/api.ts` (Hono runs in registration order):

```
cors -> GET /health -> /auth/* (Better Auth) -> POST /webhooks/* -> guard -> session -> limitBody -> every other route
```

`guard`: cross-site `sec-fetch-site` and host-mismatch origins pass only when `Origin` is in `APP_ORIGINS` (then `c.set("appOrigin", true)`); `application/json` required on POST/PUT/PATCH except `POST /builder/uploads`.

### 3.2 Endpoints

Auth column: P public, U signed in, O owner, A admin (`emailVerified && lower(email) in ADMIN_EMAILS`). WP is the owner of the handler (section 4).

**Core and account**

| Method, path | Auth | Request | Response | WP |
|---|---|---|---|---|
| GET `/health` | P | | `Health` | core |
| GET, POST `/auth/*` | P | Better Auth | Better Auth (email/password, magic link, social, callback incl. Apple form POST, `delete-user`, api keys) | auth |
| GET `/me` | U | | `Me` | auth |
| existing `/profile`, `/push/key`, `/push/subscription`, `/reminders*`, `/answers`, `/export`, `/progress`, `/notes*` | U | unchanged | unchanged | core |
| POST `/push/device` | U | `DeviceInput` | 204 | mobile |
| DELETE `/push/device` | U | `{ token }` | 204 | mobile |

Account deletion is Better Auth `POST /api/auth/delete-user` with `user.deleteUser.beforeDelete` calling `purgeUser` (section 3.6).

**Credits and billing**

| Method, path | Auth | Request | Response | WP |
|---|---|---|---|---|
| GET `/credits` | U | | `Credits`; 503 `not_configured` when billing off | credits |
| GET `/credits/ledger?before=&limit=50` | U | | `LedgerPage` | credits |
| POST `/billing/checkout` | U | `{ item: CheckoutItem }` | `{ url }`; 409 `already_subscribed` | credits |
| POST `/billing/portal` | U | | `{ url }` | credits |
| POST `/billing/fulfill` | U | `{ sessionId }` | `FulfillResult`; 404 if the session is not the caller's | credits |
| POST `/admin/credits` | A | `{ email, amount, note }` + key | `{ balance }` | credits |
| POST `/webhooks/stripe` | P | raw body, `stripe-signature` | 200; 400 bad signature | credits |
| POST `/webhooks/revenuecat` | P | JSON, `Authorization` | 200; 401 bad auth | credits |

**Grading, mock, narration**

| Method, path | Auth | Request | Response | WP |
|---|---|---|---|---|
| POST `/grade` | U | `GradeRequest` (`mockId?`) + key | `Grade` (no `improved`); 402, 502 `ai_failed`, 503 `not_configured`, 410 `mock_expired`, 409 `mock_exhausted` | meter |
| POST `/answers/:id/improve` | O | + key | `Improvement` (also saved into the answer's `grade` JSON); 409 if the answer has no grade or already has `improved` | meter |
| POST `/mock` | U | `{ courseId }` + key | `MockStart` | meter |
| GET `/narration/:course/:level?voice=` | U (course access) | | `NarrationState` | meter |
| POST `/narration` | U (course access) | `{ courseId, levelId, voice? }` + key | `NarrationState` (with `jobId` when audio is being made) | meter |
| GET `/narration/audio/:hash` | U with an unlock covering `hash` | Range | `audio/mpeg`, `Cache-Control: private, max-age=31536000, immutable` | meter |

**Builder and jobs**

| Method, path | Auth | Request | Response | WP |
|---|---|---|---|---|
| POST `/builder/uploads` | U | multipart `file` (PDF or UTF-8 text/Markdown) | `Upload`; 413, 415 | builder |
| POST `/builder/jobs` | U | `BuildRequest` + key | `202 { jobId }`; 402, 422 `topic_too_broad { suggestions }`, 429 `job_limit` | builder |
| GET `/jobs?kind=build&active=1` | U | | `Job[]` (own, newest first, max 20) | builder |
| GET `/jobs/:id?after=<seq>` | O | | `JobPoll` | builder |

**Courses, library, review**

| Method, path | Auth | Request | Response | WP |
|---|---|---|---|---|
| GET `/courses` | U | | `UserCourseMeta[]`: own + opened by link | builder |
| GET `/courses/:id` | access rule | | course JSON, `ETag: "v<version>"`; records an open for non-owners | builder |
| PUT `/courses/:id` | O | course JSON (same id) | `UserCourseMeta`; 422 `course_invalid { problems }`; `public` goes back to `pending` | builder |
| DELETE `/courses/:id` | O | | 204 | builder |
| POST `/courses/:id/share` | O | | `UserCourseMeta` (`private -> link`) | library |
| POST `/courses/:id/publish` | O | | `UserCourseMeta` (`private/link/rejected -> pending`) | library |
| POST `/courses/:id/unpublish` | O | | `UserCourseMeta` (`any -> private`) | library |
| GET `/library` | U | | `UserCourseMeta[]` (`public`, newest approval first) | library |
| POST `/flags` | U | `FlagInput` | 201 | library |
| GET `/admin/review` | A | | `ReviewQueue` | library |
| POST `/admin/courses/:id/approve` | A | | 204 (`pending -> public`) | library |
| POST `/admin/courses/:id/reject` | A | `{ note }` (1-500 chars) | 204 (`pending -> rejected`) | library |
| POST `/admin/flags/:id/resolve` | A | | 204 | library |

Access rule for a user course: owner always; any signed-in user for `link`, `pending`, `public`, `rejected`; `private` owner only (others get 404). Server lookup `findCourse(db, id, user)` checks static `COURSES` first, then `user_courses`.

**Rate limits** (`server/limits.ts`, per user, `429 rate_limited` + `Retry-After`): `/grade`, `/answers/:id/improve` 30/min; `/mock` 10/h; `/builder/jobs` 10/h; `/builder/uploads` 30/h; `/narration` 60/h; `/billing/checkout`, `/billing/portal` 20/h; `/flags` 30/h. Auth uses Better Auth's limiter (sign-in 5/min, sign-up 5/h per IP from `IP_HEADER`). Webhooks are not limited.

### 3.3 Shared types (`shared/api-types.ts`)

Written once by WP2; frozen in wave B (changes go through the coordinator).

```ts
export type ErrorCode =
  | "invalid_request" | "unauthorized" | "insufficient_credits" | "origin_not_allowed" | "forbidden" | "not_found"
  | "idempotency_conflict" | "in_progress" | "already_subscribed" | "mock_exhausted" | "mock_expired"
  | "too_large" | "unsupported_media_type" | "topic_too_broad" | "course_invalid" | "rate_limited" | "job_limit"
  | "ai_failed" | "not_configured";
export interface ApiErrorBody { error: string; code: ErrorCode; [extra: string]: unknown }

export interface Health { ok: true; commit: string; grader: boolean; narration: boolean }

export type Action = "course_topic" | "course_files" | "course_web" | "grade" | "improve" | "mock" | "narration";
export type Costs = Record<Action, number>;

export interface Subscription {
  provider: "stripe" | "revenuecat";
  store?: "app_store" | "play_store";
  status: "active" | "past_due" | "canceled" | "expired";
  periodEnd: string | null;            // ISO
  cancelAtPeriodEnd: boolean;
}
export interface Credits {
  plan: number; topup: number; total: number;
  planExpiresAt: string | null;
  freeCourses: number;                 // free topic builds left
  subscription: Subscription | null;
  costs: Costs; confirmAt: number; lowAt: number;
  notice?: string;                     // CREDITS_NOTICE
}
export interface Me {
  user: string;                        // Better Auth user id
  email: string; name: string; image?: string;
  admin: boolean;
  aliases: string[];                   // legacy ids claimed by this user (old email key, "local", "")
  features: { ai: boolean; billing: boolean; narration: boolean };
  credits: Credits | null;             // null when billing off
  limits: { uploadMaxBytes: number; uploadMaxFiles: number };
}

export type LedgerKind = "plan_grant" | "plan_expire" | "pack" | "spend" | "refund" | "free_course" | "free_refund" | "store_refund" | "stripe_refund" | "adjust";
export interface LedgerRow { id: string; kind: LedgerKind; delta: number; action: Action | null; ref: string | null; label: string | null; createdAt: string }
// label: course title (builds, mock) or level title (narration); the client adds "Course: ", "Mock exam: ", "Narration: "
export interface LedgerPage { rows: LedgerRow[]; next: string | null }

export type CheckoutItem = "plan" | "pack_s" | "pack_l";
export interface FulfillResult { status: "paid" | "processing" | "unpaid" | "expired"; item: CheckoutItem; credited: number; balance: number }

// Grading: GradeRequest gains `mockId?: string`; Grade gains optional `improved` and `corrections`.
export interface Correction { quote: string; fix: string }
export interface Improvement { improved: string; corrections: Correction[] }
export interface MockStart { mockId: string; expiresAt: string }

export type SkillLevel = "beginner" | "intermediate" | "advanced";
export type BuildRequest =
  | { mode: "topic"; topic: string; level: SkillLevel; lang: string }
  | { mode: "files"; uploads?: string[]; noteIds?: string[]; urls?: string[]; level: SkillLevel; lang: string; instructions?: string }
  | { mode: "web"; topic: string; level: SkillLevel; lang: string };
export interface Upload { id: string; name: string; bytes: number }

export type JobStatus = "queued" | "running" | "done" | "failed";
export interface Job {
  id: string; kind: "build" | "narration"; status: JobStatus;
  title: string | null;                // topic, or outline title once known
  mode?: BuildRequest["mode"];
  result: { courseId: string } | null;
  error: { code: string; message: string; refunded: boolean; free?: boolean } | null;
  createdAt: string; finishedAt: string | null;
}
export type JobEvent = { seq: number; at: string } & (
  | { type: "stage"; data: { stage: "research" | "read" | "outline" | "write" | "validate" | "fix" | "save"; done?: number; of?: number } }
  | { type: "sources"; data: { count: number } }
  | { type: "outline"; data: { title: string; levels: { id: string; title: string }[] } }
  | { type: "level"; data: { id: string; status: "written" | "fixed" } }
  | { type: "problems"; data: { attempt: number; count: number } }
  | { type: "done"; data: { courseId?: string; tracks?: number } }
  | { type: "failed"; data: { code: string; message: string; refunded: boolean } }
);
export interface JobPoll { job: Job; events: JobEvent[] }

export type CourseStatus = "private" | "link" | "pending" | "public" | "rejected";
export type CourseMode = "topic" | "files" | "web" | "upload";
export interface UserCourseMeta {
  id: string; title: string; lang: string; summary: string | null;
  status: CourseStatus; mine: boolean; author: string; mode: CourseMode;
  levels: number; sources: number; version: number;
  reviewNote: string | null; updatedAt: string; publishedAt: string | null;
}
export type FlagReason = "wrong" | "unclear" | "broken" | "other";
export interface FlagInput { courseId: string; itemId?: string; reason: FlagReason; text?: string } // text <= 500
export interface Flag extends FlagInput { id: string; count: number; createdAt: string }
export interface ReviewQueue { pending: UserCourseMeta[]; flags: Flag[] }

export interface NarrationTrack { card: number; hash: string; ready: boolean }
export interface NarrationState { unlocked: boolean; cost: number; voice: string; tracks: NarrationTrack[]; jobId?: string }

export interface DeviceInput { token: string; platform: "ios" | "android" }
```

Course schema change (MIT, `src/course/schema.ts`): `TheoryCardSchema.sources: z.array(z.object({ url: z.url({ protocol: /^https?$/ }), title: z.string().min(1) }).strict()).optional()`.

### 3.4 Pricing and brand config

`shared/pricing.ts` (every tunable number; no secrets):

```ts
export const CURRENCY = "eur";
export const PLAN = { credits: 1000, priceCents: 1199, lookupKey: "questie_plan_monthly_1199", rcProducts: ["questie.plan.monthly", "questie.plan.monthly:monthly"] } as const;
export const PACKS = {
  pack_s: { credits: 500, priceCents: 599, lookupKey: "questie_pack_500_599", rcProducts: ["questie.credits.500"] },
  pack_l: { credits: 1500, priceCents: 1499, lookupKey: "questie_pack_1500_1499", rcProducts: ["questie.credits.1500"] },
} as const;
export const COSTS = { course_topic: 100, course_files: 150, course_web: 200, grade: 2, improve: 3, mock: 20, narration: 10 } as const;
export const FREE_COURSES = 1;      // topic mode only
export const CONFIRM_AT = 100;      // client confirms spends >= this
export const LOW_BALANCE = 100;     // one warning per period
export const PLAN_GRACE_DAYS = 1;   // plan credits live until period end + grace
export const BUILD = {
  uploadMaxFiles: 10, uploadMaxBytes: 20 * 1024 * 1024, textMaxBytes: 500 * 1024, urlsMax: 3,
  topicMin: 3, topicMax: 200, instructionsMax: 2000,
  webMaxSearches: 8, fetchMaxUses: 10, minSources: 3, fixAttempts: 3, writeConcurrency: 3,
} as const;
```

`shared/brand.ts` (plan wave 1 placeholders, one place): `SITE_URL = "https://questie.app"`, `APP_URL = "https://app.questie.app"`, `APP_ID = "app.questie"`, `REPO = "chdominguez/questlog"`. Server runtime uses the `APP_URL` env; site, Capacitor and the Profile source link import these.

### 3.5 Server module interfaces

WP2 creates every file below with this signature and a stub body, so wave B packages compile and test against each other before the real code lands. The owner replaces the stub.

```ts
// server/db.ts (WP2, real)
export interface Tx { get<T>(sql: string, ...a: unknown[]): T | undefined; all<T>(sql: string, ...a: unknown[]): T[]; run(sql: string, ...a: unknown[]): number }
export interface Db { prepare(sql: string): Stmt; tx<T>(fn: (q: Tx) => T): T }   // BEGIN IMMEDIATE; fn must be sync
export function openDb(path: string): Db & { sqlite: DatabaseSync }               // WAL, busy_timeout=5000, foreign_keys=ON

// server/api.ts (WP2, real)
export interface SessionUser { id: string; email: string; name: string; emailVerified: boolean; image?: string | null }
export interface Deps {
  courses: Course[];
  session(c: Context<App>): Promise<SessionUser | null>;
  grader(env: Env): Grader | null;
  improver(env: Env): Improver | null;
  anthropic(env: Env): Anthropic | null;        // builder, topic pre-check
  stripe(env: Env): Stripe | null;
  fetch: typeof fetch;                          // ElevenLabs, Resend, FCM
  sandbox: KataRunner;
  now(): Date;
}
export function createApi(deps?: Partial<Deps>): Hono<App>
// App = { Bindings: Env; Variables: { user: string; account: SessionUser; appOrigin?: boolean } }

// server/errors.ts (WP2, real)
export function err(c: Context, status: number, code: ErrorCode, extra?: object, message?: string): Response

// server/admin.ts (WP2, real)
export const isAdmin: (u: SessionUser, env: Env) => boolean;
export const requireAdmin: MiddlewareHandler<App>;

// server/limits.ts (WP2, real)
export function limit(name: string, max: number, windowSec: number): MiddlewareHandler<App>

// server/env.ts (WP2, real): Env type with every var in 3.8; readEnv(process.env) with boot checks

// server/auth.ts (auth; stub: session() returns null)
export function createAuth(env: Env, sqlite: DatabaseSync, deps: Deps): BetterAuth
export function authRoutes(deps: Deps): Hono<App>      // public: /auth/*
export function meRoutes(deps: Deps): Hono<App>        // private: GET /me (stub returns Me from SessionUser with credits(), no aliases)
export function sessionFrom(auth): Deps["session"]

// server/credits.ts (credits; stub = billing off: spend ok with spendId null, refund false, credits() null)
export function metered(env: Env): boolean
export function balance(db: Db, user: string, now?: Date): { plan: number; topup: number; total: number; planExpiresAt: string | null; freeCourses: number }
export function credits(db: Db, env: Env, user: string): Credits | null
export function spend(db: Db, env: Env, a: { user: string; action: Action; key: string; ref: string; allowFree?: boolean }):
  | { ok: true; spendId: string | null; free: boolean; replay: boolean; balance: number }
  | { ok: false; code: "insufficient_credits" | "idempotency_conflict" | "in_progress"; cost: number; balance: number }
export function refund(db: Db, spendId: string, note?: string): boolean           // also undoes a free course
export function grant(db: Db, g: { user: string; kind: LedgerKind; plan?: number; topup?: number; source: string; sourceId: string; ref?: string; note?: string; periodEnd?: string }): boolean
export function charge(c: Context<App>, action: Action, ref: string, run: () => Promise<Response>): Promise<Response>
// spend -> 402/409 response; run(); on throw: refund + 502 ai_failed { refunded }; sets x-credits-balance
export function billingPublic(deps: Deps): Hono<App>   // /webhooks/*
export function billingRoutes(deps: Deps): Hono<App>   // /credits*, /billing/*, /admin/credits
// server/billing.ts (credits; stub no-op)
export function cancelForUser(db: Db, env: Env, deps: Deps, user: string): Promise<void>

// server/jobs.ts (builder; stub runs the handler inline on setImmediate, no persistence)
export class JobError extends Error { constructor(public code: string, message: string) }
export type JobHandler = (job: { id: string; user: string; input: unknown }, ctx: { db: Db; env: Env; deps: Deps; emit(type: JobEvent["type"], data: object): void }) => Promise<object>
export function registerJob(kind: "build" | "narration", h: JobHandler): void
export function enqueue(db: Db, j: { user: string; kind: "build" | "narration"; title?: string; input: unknown; spendId: string | null }): string
export function startJobs(env: Env, deps: Deps): () => void
// failure: status failed + refund(spendId) + "failed" event, in one tx

// server/courses.ts (builder; stub = static COURSES only)
export function findCourse(db: Db, id: string, user: string): Promise<Course | null>
export function saveUserCourse(db: Db, a: { owner: string; course: CourseInput; mode: CourseMode; sourceJobId?: string }): Promise<string>
export function coursesRoutes(deps: Deps): Hono<App>

// server/sandbox.ts (builder; stub = reject every kata run)
export type KataRunner = (kata: Kata, code: string) => Promise<TestResult[]>

// Route modules, each `(deps: Deps) => Hono<App>`, mounted once by WP2:
// grading.ts (meter: /grade, /answers/:id/improve, /mock), narration.ts (meter), builder.ts (builder: /builder/*, /jobs*),
// library.ts (library), devices.ts (mobile), plus authRoutes/meRoutes, billingPublic/billingRoutes, coursesRoutes.

// server/account.ts (auth)
export function purgeUser(db: Db, user: string): void   // deletes every row in the table list of 3.6
```

### 3.6 Database

Migrations run once each, sorted by name, from `migrations/` (cwd). No foreign keys across files, so merge order does not matter. WP2 writes 0005-0010 verbatim from this section; WP-auth generates 0004. After WP2, each file belongs to the WP shown; until the branch merges to main, its owner edits it in place rather than adding a new file.

| File | WP | Tables |
|---|---|---|
| `0004_auth.sql` | auth | Better Auth `user`, `session`, `account`, `verification`, `apikey` (generated by `npx @better-auth/cli generate`, committed); `legacy_claims` |
| `0005_credits.sql` | credits | `credit_ledger`, `credit_balances`, `billing_customers`, `subscriptions`, `webhook_events` |
| `0006_courses.sql` | builder | `user_courses`, `course_opens` |
| `0007_jobs.sql` | builder | `jobs`, `job_events`, `uploads` |
| `0008_metering.sql` | meter | `mock_sessions`, `narration_audio`, `narration_tracks`, `narration_unlocks` |
| `0009_library.sql` | library | `flags` |
| `0010_devices.sql` | mobile | `device_tokens` |

```sql
-- 0004 (handwritten part)
CREATE TABLE legacy_claims (old_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, claimed_at TEXT NOT NULL);

-- 0005_credits.sql
CREATE TABLE credit_ledger (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  kind TEXT NOT NULL,                       -- LedgerKind
  plan_delta INTEGER NOT NULL DEFAULT 0, topup_delta INTEGER NOT NULL DEFAULT 0,
  action TEXT,                              -- Action for spend/refund/free rows
  source TEXT NOT NULL,                     -- stripe_invoice | stripe_checkout | stripe_refund | rc | spend | refund | expire | free | admin
  source_id TEXT NOT NULL,
  ref TEXT, note TEXT, created_at TEXT NOT NULL,
  UNIQUE (source, source_id)
);
CREATE INDEX credit_ledger_user ON credit_ledger (user_id, created_at);
CREATE TABLE credit_balances (user_id TEXT PRIMARY KEY, plan INTEGER NOT NULL DEFAULT 0, topup INTEGER NOT NULL DEFAULT 0, plan_expires_at TEXT, free_courses_used INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
CREATE TABLE billing_customers (user_id TEXT PRIMARY KEY, stripe_customer_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
CREATE TABLE subscriptions (
  provider TEXT NOT NULL, external_id TEXT NOT NULL, user_id TEXT NOT NULL,
  store TEXT, status TEXT NOT NULL, period_end TEXT, cancel_at_period_end INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
  PRIMARY KEY (provider, external_id)
);
CREATE INDEX subscriptions_user ON subscriptions (user_id);
CREATE TABLE webhook_events (provider TEXT NOT NULL, event_id TEXT NOT NULL, type TEXT NOT NULL, received_at TEXT NOT NULL, PRIMARY KEY (provider, event_id));

-- 0006_courses.sql
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

-- 0007_jobs.sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  kind TEXT NOT NULL,                       -- build | narration
  status TEXT NOT NULL,                     -- queued | running | done | failed
  title TEXT, input TEXT NOT NULL, result TEXT, error TEXT,
  spend_id TEXT, attempts INTEGER NOT NULL DEFAULT 0, usage TEXT,
  created_at TEXT NOT NULL, started_at TEXT, heartbeat_at TEXT, finished_at TEXT
);
CREATE INDEX jobs_queue ON jobs (status, created_at);
CREATE INDEX jobs_user ON jobs (user_id, created_at);
CREATE TABLE job_events (job_id TEXT NOT NULL, seq INTEGER NOT NULL, at TEXT NOT NULL, type TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (job_id, seq));
CREATE TABLE uploads (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, file_id TEXT NOT NULL, name TEXT NOT NULL, bytes INTEGER NOT NULL, job_id TEXT, created_at TEXT NOT NULL);

-- 0008_metering.sql
CREATE TABLE mock_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, course_id TEXT NOT NULL, spend_id TEXT, grades_left INTEGER NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE narration_audio (hash TEXT PRIMARY KEY, voice TEXT NOT NULL, chars INTEGER NOT NULL, bytes INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE narration_tracks (course_id TEXT NOT NULL, version TEXT NOT NULL, level_id TEXT NOT NULL, voice TEXT NOT NULL, card INTEGER NOT NULL, hash TEXT NOT NULL, PRIMARY KEY (course_id, version, level_id, voice, card));
CREATE TABLE narration_unlocks (user_id TEXT NOT NULL, course_id TEXT NOT NULL, level_id TEXT NOT NULL, voice TEXT NOT NULL, spend_id TEXT, created_at TEXT NOT NULL, PRIMARY KEY (user_id, course_id, level_id, voice));

-- 0009_library.sql
CREATE TABLE flags (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, course_id TEXT NOT NULL, item_id TEXT, reason TEXT NOT NULL, text TEXT, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL);
CREATE INDEX flags_open ON flags (status, created_at);

-- 0010_devices.sql
CREATE TABLE device_tokens (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, platform TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX device_tokens_user ON device_tokens (user_id);
```

Rules on this data:

- Per-user tables (re-keyed by `claimLegacy`, purged by `purgeUser`): `answers`, `notes`, `kv`, `push_subscriptions`, `reminders`, `credit_ledger`, `credit_balances`, `billing_customers`, `subscriptions`, `user_courses` (`owner_id`), `course_opens`, `jobs` (+ their `job_events`), `uploads`, `mock_sessions`, `narration_unlocks`, `flags`, `device_tokens`, `legacy_claims`. `claimLegacy` moves only the first five (the others are new).
- `claimLegacy(db, user)` on the first request per user per process: candidates `lower(email)` when verified, plus `local` and `''` for the first account ever (`kv('', 'claimed_local')` marker). Per candidate in one `tx`: `INSERT OR IGNORE INTO legacy_claims`; if inserted, `UPDATE OR IGNORE <t> SET user_id = :new WHERE user_id = :old` on the five tables. Nothing is deleted.
- Ledger: `credit_balances` is a cache written in the same `tx` as each ledger row. Plan grant sets plan to `PLAN.credits` (writes `plan_expire` for leftovers first). Lazy expiry once per period (`source = expire`, `source_id = <user>:<plan_expires_at>`). Spend plan first, one `spend` row with both deltas, `source_id = <user>:<Idempotency-Key>`. Refund mirrors the spend, `source_id = <spend id>`. Free course: `free_course` row with zero deltas, `free_refund` on failure. Balance goes negative only through `stripe_refund` / `store_refund`.
- Fix the positional `INSERT INTO answers VALUES` / `INSERT INTO notes VALUES` in `server/api.ts` to name columns (WP2).
- User course id: `u<10 base36 random>-<slug>`, matches `COURSE_DIR`, checked against static ids.
- Narration audio: `<mediaRoot>/_audio/<sha256(model \n voice \n text)>.mp3` (the `_` fails `COURSE_DIR`, so `/media` never serves it).

### 3.7 Events

Job events: the `JobEvent` union in 3.3, stored in `job_events`, read by polling `GET /jobs/:id?after=` every 2 s (no SSE: `EventSource` cannot send the bearer header).

| Build stage by mode | Stages emitted |
|---|---|
| topic | outline, write (done/of), validate, fix, save |
| files | read, outline, write, validate, fix, save (plus research when URLs are given) |
| web | research (+ `sources`), outline, write, validate, fix, save |

Webhooks handled (everything else: 200, no-op):

| Provider | Event | Effect |
|---|---|---|
| Stripe | `checkout.session.completed`, `checkout.session.async_payment_succeeded` | `mode=payment`, `payment_status=paid`: `fulfill` grants the pack (`stripe_checkout`, session id). `mode=subscription`: upsert `subscriptions` |
| Stripe | `invoice.paid` (`billing_reason` `subscription_create` / `subscription_cycle`) | plan grant (`stripe_invoice`, invoice id), `periodEnd` from the subscription line |
| Stripe | `customer.subscription.created/updated/deleted` | re-read the subscription from Stripe, upsert state |
| Stripe | `charge.refunded` (pack) | `stripe_refund`, `-credits * refunded / amount`, rounded down |
| RevenueCat | `INITIAL_PURCHASE`, `RENEWAL` (plan product) | plan grant (`rc`, event id), upsert `subscriptions` (`external_id = original_transaction_id`, `store`) |
| RevenueCat | `NON_RENEWING_PURCHASE` (pack product) | pack grant |
| RevenueCat | `CANCELLATION` of a pack (refund) | `store_refund`, `-credits` |
| RevenueCat | `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE` (plan) | update `subscriptions.status` only |

Webhook handling: verify first; async reads from Stripe before the `tx`; inside one `tx`: `INSERT OR IGNORE INTO webhook_events`, return 200 if it was a duplicate, else apply. RevenueCat `app_user_id` must exist in `user`, else 200 and log.

Push payloads: Web Push `{ title, body, url: "/#/c/<course>" }` (unchanged); FCM data `{ url }` with the same value. Native taps set `location.hash` from `url`.

Client-side events and stores:

| Source | Event | Listener |
|---|---|---|
| `apiFetch` | header `x-credits-balance` | `setBalance(n)` in the session store (chip, sheets) |
| `apiFetch` | 401 | `markSignedOut()`; local progress untouched |
| `call()` | 402 | `openTopUp({ cost, balance })` once, then throws `ApiError` |
| `registerCourses` | courses changed | `useCourses()` re-renders Home, App, Library |
| session store | `signedIn` after `loadMe` | `switchUser(me)` then `startSync()`; native: RevenueCat `logIn(me.user)` |
| native | `appUrlOpen` | magic-link verify; `/c/<id>` -> `#/c/<id>` |
| native | push tap | `location.hash = data.url` |
| Better Auth | `user.deleteUser.beforeDelete` | `cancelForUser` then `purgeUser` |

### 3.8 Env vars

Server reads all of them in `server/env.ts` (WP2). Fails at boot when `APP_URL` or `BETTER_AUTH_SECRET` is missing, or when only one of the two Stripe vars is set.

| Var | Required | Default | Purpose | WP |
|---|---|---|---|---|
| `DB_PATH` | no | `data/questlog.db` (image `/data/questlog.db`) | SQLite file; never renamed | core |
| `MEDIA_DIR` | no | `<db dir>/media` | Course media, `_audio/` | core |
| `MEDIA_MAX_BYTES` | no | `52428800` | MCP media upload cap (exists) | core |
| `HOST`, `PORT` | no | `127.0.0.1`, `8787` | Listen address | core |
| `APP_URL` | yes | | Public app URL; auth callbacks, Stripe redirects | core |
| `APP_ORIGINS` | no | `capacitor://localhost,https://localhost` | Bearer-only trusted origins | core |
| `IP_HEADER` | no | `x-forwarded-for` | Client IP header (`fly-client-ip` on Fly) | core |
| `BETTER_AUTH_SECRET` | yes | | 32+ random bytes | auth |
| `SIGNUP` | no | `open` | `closed` stops new email sign-ups | auth |
| `ADMIN_EMAILS` | no | | Comma list of admins | auth |
| `RESEND_API_KEY`, `EMAIL_FROM` | no | | Verification, magic link, reset mail; unset = verification off, links logged | auth |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no | | Google sign-in | auth |
| `GOOGLE_NATIVE_CLIENT_IDS` | no | | iOS/Android client ids accepted as ID-token audience | auth |
| `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_BUNDLE_ID` | no | | Apple sign-in, web and native | auth |
| `ANTHROPIC_API_KEY` | no | | Grading, builder, mock; unset = `features.ai` false | meter, builder |
| `JOB_CONCURRENCY` | no | `2` | Jobs at once | builder |
| `ELEVENLABS_API_KEY` | no | | Narration; unset = hidden | meter |
| `ELEVENLABS_VOICES` | with key | | Voice ids, first is default | meter |
| `ELEVENLABS_MODEL` | no | `eleven_multilingual_v2` | | meter |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | no | | Both set = billing and metering on | credits |
| `REVENUECAT_WEBHOOK_AUTH` | no | | Expected `Authorization` value | credits |
| `CREDITS_NOTICE` | no | | Cost-change notice text | credits |
| `VAPID_PUBLIC`, `VAPID_PRIVATE`, `VAPID_SUBJECT` | no | | Web Push (unchanged) | core |
| `FCM_SERVICE_ACCOUNT` | no | | Base64 service-account JSON for native push | mobile |
| `LITESTREAM_BUCKET` | no | | Set = replication on | ops |
| `LITESTREAM_PATH` | no | | Key prefix | ops |
| `LITESTREAM_ENDPOINT`, `LITESTREAM_REGION` | no | AWS | S3-compatible endpoint, region | ops |
| `LITESTREAM_ACCESS_KEY_ID`, `LITESTREAM_SECRET_ACCESS_KEY` | with bucket | | Replica credentials (`AWS_*` also read) | ops |
| `QUESTIE_COURSES` (`QUESTLOG_COURSES` read too) | no | `courses-private` | Build-time private courses | rename |
| `COMMIT` (Docker build arg) | no | `dev` | Becomes `VITE_COMMIT`; `/health.commit`, Profile source link | ops |

Removed: `USER_HEADER`, `NAME_HEADER`, `LOGOUT_URL`.

Client build vars (Vite): `VITE_API_BASE` (native builds only), `VITE_DEMO` (site demo), `VITE_COMMIT`, `VITE_REVENUECAT_IOS_KEY`, `VITE_REVENUECAT_ANDROID_KEY`, `VITE_GOOGLE_WEB_CLIENT_ID`, `VITE_GOOGLE_IOS_CLIENT_ID` (native Google sign-in).

MCP vars: `QUESTIE_URL` (`QUESTLOG_URL` read too), `QUESTIE_TOKEN` (`QUESTLOG_TOKEN` read too, Better Auth API key sent as `x-api-key`, accepted on `GET /notes*` only), `QUESTLOG_HEADERS` kept one release.

### 3.9 Client contract

Hash routes (`src/ui/route.ts`; the parser ignores `?query` inside the hash and exposes it):

| Route | Hash | Screen file | WP | Auth |
|---|---|---|---|---|
| signin | `#/signin?next=` | `src/auth/SignInScreen.tsx` | auth | public |
| signup | `#/signup` | `src/auth/SignUpScreen.tsx` | auth | public |
| verify | `#/verify` | `src/auth/VerifyScreen.tsx` | auth | public |
| forgot | `#/forgot` | `src/auth/ForgotScreen.tsx` | auth | public |
| reset | `#/reset` (token from `location.search`, else hash query) | `src/auth/ResetScreen.tsx` | auth | public |
| welcome | `#/welcome` | `src/screens/Welcome.tsx` | builder | signed in |
| plans | `#/plans?canceled=1` | `src/billing/PlansScreen.tsx` | credits | signed in |
| billingDone | `#/billing/done` (`?session_id=` before the hash) | `src/billing/BillingDoneScreen.tsx` | credits | signed in |
| credits | `#/profile/credits` | `src/billing/CreditsScreen.tsx` | credits | signed in |
| build | `#/build` | `src/builder/BuildScreen.tsx` | builder | signed in |
| job | `#/build/:job` | `src/builder/JobScreen.tsx` | builder | owner |
| library | `#/library` | `src/screens/Library.tsx` | library | signed in |
| adminReview | `#/admin/review` | `src/library/QueueScreen.tsx` | library | admin, else NotFound |

Signed-out on a private route: `#/signin?next=<hash>`. Path links `/c/<id>` are rewritten to `#/c/<id>` in `main.tsx`. Hud nav: `Courses`, `Library`, `Build` (when `features.ai`), `Profile`, then `CreditChip`.

Client modules and their signatures (WP2 creates them; the WP column owns them in wave B):

| File | Exports | WP |
|---|---|---|
| `src/platform.ts` | `isNative`, `platform: "web" \| "ios" \| "android"`, `isDemo`, `API_BASE`, `apiUrl(path)` | core |
| `src/api.ts` | `ApiError(status, message, body)`, `apiFetch(path, init)`, `call<T>(path, init)`, `newKey()` | core |
| `src/auth/session.ts` | `useSession(): { status: "loading" \| "signedOut" \| "signedIn" \| "offline"; me?: Me }`, `getMe()`, `loadMe()`, `setBalance(n)`, `markSignedOut()`; caches `ql.me` | auth |
| `src/auth/token.ts` | `getToken()`, `setToken(t \| null)`, `loadToken()`, `registerTokenStore({ load, save, clear })` (in memory on web) | auth |
| `src/auth/client.ts` | Better Auth client (`bearer` fetch options on native) | auth |
| `src/auth/Gate.tsx` | `<Gate>` renders children, sign-in screens, or nothing per session status; pass-through when `isDemo` | auth |
| `src/billing/topup.ts` | `openTopUp({ cost?, balance? })`, `closeTopUp()`, `useTopUp()` | credits |
| `src/billing/CostButton.tsx` | `<CostButton action label free? busy? busyLabel? disabled? className? onPress() />`: shows `label · cost` (or `· Free`, or plain when billing is off), confirms when cost >= `confirmAt`, hidden when `isDemo` | credits |
| `src/billing/{CreditChip,LowBalance,TopUpSheet,ProfileBilling}.tsx` | mounted by WP2 in Hud, App, Profile | credits |
| `src/course/registry.ts` | adds `registerCourses(raw[])`, `unregisterCourse(id)`, `useCourses()`, `subscribeCourses`, `coursesLoaded()`; bundled ids win | builder |
| `src/builder/api.ts` | `loadCourses()` (meta list, fetch JSON for new versions, cache `ql.courses`), `startBuild`, `uploadSource`, `getJob`, `listJobs` | builder |
| `src/builder/JobCards.tsx`, `src/engine/Sources.tsx` | Home job cards; citations list under a theory card | builder |
| `src/library/{ShareButton,StatusPill,ReportButton,AdminLink}.tsx` | Map share, Home pill, report flag, Profile link | library |
| `src/narration/Narration.tsx` | `<Narration course level />` | meter |
| `src/auth/AccountSection.tsx` | sign out, delete account, AGPL source link (`REPO` + `VITE_COMMIT`) | auth |
| `src/native/index.ts` | `init()`: token store, back button, `appUrlOpen`, push listeners | mobile |
| `src/native/social.ts` | `idToken(provider: "google" \| "apple"): Promise<{ token: string; nonce?: string } \| null>` | mobile |
| `src/native/purchases.ts` | `configure(userId)`, `logOut()`, `offerings(): Promise<{ id: string; item: CheckoutItem; price: string }[]>`, `purchase(id): Promise<"ok" \| "cancelled" \| "pending">`, `restore()`, `managementUrl()` | mobile |
| `src/native/push.ts` | `pushState()`, `enablePush()` (native branch of `src/engine/push.ts`) | mobile |

Native modules load only through `import()` behind `isNative`. Demo (`VITE_DEMO`): no gate, no sync, no service worker, no cost buttons; written answers go to self-rating; header link "Sign up" to `APP_URL`.

Storage keys: `questie-v1` (progress; read `questlog-v1` when missing, copy never move), `ql.user`, `ql.me`, `ql.courses`, `ql.kata.*`, `ql.welcomed.<user>`, `ql.lowWarned` (period end), `ql.notice.<hash>`, `sessionStorage` `ql.checkout` (`{ returnTo, draft }`), `ql.mock.<course>`, `questie:map:<course>` (read `questlog:questie:<course>`).

## 4. Work packages

### 4.1 Waves

```
Wave A1  WP1 rename + licensing
Wave A2  WP2 core scaffold (the contract in code)          depends WP1
Wave B   WP3 auth | WP4 credits+billing | WP5 builder | WP6 ai-meter+narration
         WP7 library | WP8 site | WP9 ops | WP10 mobile     each depends WP2 only
Wave C   WP11 integration + E2E                             depends all
```

Wave B packages have disjoint write scopes. Cross-package calls go through the stubs in 3.5 and 3.9, so no wave B package waits on another to compile or test. Hot files are written in wave A and frozen in wave B:

| Hot file | Wave A writer | Wave B |
|---|---|---|
| `package.json`, `package-lock.json` | WP1 (name, license), WP2 (every dependency and script below) | frozen; a missing dependency is a coordinator request |
| `server/api.ts`, `server/index.ts`, `server/env.ts`, `server/db.ts`, `server/api.test.ts` | WP2 | frozen |
| `shared/api-types.ts`, `src/course/schema.ts`, `shared/media.ts` | WP2 (WP1 adds SPDX headers first) | frozen |
| `src/App.tsx`, `src/main.tsx`, `src/ui/route.ts`, `src/engine/Hud.tsx`, `src/engine/Theory.tsx`, `src/engine/Challenge.tsx`, `src/screens/{Map,Level,Profile}.tsx` | WP2 (mount lines only) | frozen |
| `vite.config.ts`, `tsconfig.json`, `.gitignore` | WP1, WP2 | frozen |
| `migrations/0005-0010` | WP2 writes from 3.6 | owner WP per 3.6 |
| `.github/workflows/ci.yml`, `README.md` | WP1 | WP9 |

Dependencies WP2 installs (pinned): `better-auth`, `stripe`, `@capacitor/core`, `@capacitor/app`, `@capacitor/ios`, `@capacitor/android`, `@capacitor-firebase/messaging`, `firebase`, `@revenuecat/purchases-capacitor`, `@capgo/capacitor-social-login`, `@aparajita/capacitor-secure-storage`; dev `@capacitor/cli`, `@better-auth/cli`.

Scripts WP2 adds: `build:server` = `vite build --ssr server/index.ts --outDir dist-server && KATA=1 vite build --ssr server/kata-child.ts --outDir dist-server/kata`; `site:schema`, `site:demo`, `site:build`, `site:dev` (site design 1.7); `build:mobile` (`vite build --mode mobile`, reading `VITE_API_BASE` from a committed `.env.mobile`), `cap:sync`, `cap:android`, `cap:ios`, `cap:assets`; `stripe:setup` (`tsx scripts/stripe-setup.ts`). `vite.config.ts`: `define` for `VITE_COMMIT`, `ssr.noExternal: true` when `KATA=1`.

### 4.2 WP1: rename + licensing (wave A1)

Goal: REN-1..7, LIC-1..6. No behavior change beyond keys and names. Data never lost.

Owns (edits):
- Rename: `package.json` (`name: questie`, `license: AGPL-3.0-only`), `package-lock.json` (name), `index.html`, `public/manifest.webmanifest`, `public/sw.js`, `src/engine/Hud.tsx` (brand text), `src/engine/store.ts` + test (`questie-v1`, copy from `questlog-v1`), `src/engine/sync.ts` (wipe list: both keys), `src/questie/Questie.tsx` (key with fallback), `src/code/highlighter.ts`, `src/course/registry.ts` (env fallback only), `tsconfig.json` + `vite.config.ts` (`QUESTIE_COURSES ?? QUESTLOG_COURSES`, aliases `questie/authoring` and `questlog/authoring`), `scripts/validate.ts`, `scripts/import-answers.ts` (text only, default DB unchanged), `courses/**` imports to `questie/authoring`, `mcp/**` (both env names, server name `questie`, URIs `questie://schema/course`, `questie://guide/authoring`, plugin path), `.mcp.json`, `.claude-plugin/marketplace.json`, `git mv plugins/questlog plugins/questie` (skill `questie-course`), test tmpdir prefixes, `README.md`, `mcp/README.md`.
- Licensing: `LICENSE` (AGPL-3.0 text), `LICENSES/{AGPL-3.0-only,MIT,CC-BY-4.0}.txt`, `REUSE.toml`, `NOTICE`, `CLA.md`, `CONTRIBUTING.md`, SPDX headers on `src/course/schema.ts`, `src/course/authoring.ts`, `shared/media.ts`, `.github/workflows/cla.yml`, `.github/workflows/dco.yml`, `.github/workflows/ci.yml` (add `npm run validate` and `fsfe/reuse-action@v5`). Texts and workflows exactly as site design section 2.

Does not touch: `Dockerfile`, `docker-compose.yml`, `.github/workflows/deploy.yml`, `server/**` (`questlog.db` stays).

Done when: `npm test`, `npm run typecheck`, `npm run validate`, `reuse lint` pass; `git grep -i questlog` shows only intended fallbacks (`questlog-v1`, `QUESTLOG_*`, `questlog/authoring`, `questlog.db`, deploy files, repo URL).

### 4.3 WP2: core scaffold (wave A2)

Goal: every interface in section 3 exists in code, hot files are final, stubs let wave B run in parallel.

Owns: hot files in 4.1; `server/{env,errors,admin,limits}.ts` (+tests); `server/db.ts` (pragmas, `tx`, `sqlite`) + test; `server/api.ts` (cors, mount order, `guard` changes, `limitBody`, `Deps`, `/health`, named-column inserts, `/grade` moved out to `server/grading.ts`, `/me` moved to `meRoutes`); `server/index.ts` (readEnv, `createAuth`, `startJobs`, reminders, `/.well-known/apple-app-site-association` served as `application/json`); `server/api.test.ts` (fake `session` dep replaces the proxy-header tests; isolation tests kept); stub files from 3.5 (`auth.ts`, `account.ts`, `credits.ts`, `billing.ts`, `jobs.ts`, `courses.ts`, `sandbox.ts`, `kata-child.ts`, `grading.ts` (holds the moved `/grade`, unchanged behavior), `narration.ts`, `builder.ts`, `library.ts`, `devices.ts`); `shared/api-types.ts`; `shared/pricing.ts`; `shared/brand.ts`; `shared/media.ts` (`base` argument); `src/course/schema.ts` (`sources`); migrations `0005`-`0010`; client files from 3.9 marked core plus stubs for every other file in that table and every screen in the route table; `src/course/registry.ts` runtime part + `courses.test.ts`; `src/answers/api.ts` (re-export `ApiError` from `src/api.ts`, `fetch` -> `apiFetch`); `src/engine/sync.ts` (`apiFetch`; `startSync(me)` called by the session store, no own `/me` fetch); mount lines in `src/App.tsx` (Gate, routes, `TopUpSheet`, `LowBalance`), `src/main.tsx` (`loadToken`, native `init`, `?session_id` kept for BillingDone, `/c/<id>` rewrite, demo skips, cached courses before first render), `src/engine/Hud.tsx` (nav, `CreditChip`), `src/engine/Theory.tsx` (`Sources`, `ReportButton`), `src/engine/Challenge.tsx` (`ReportButton`), `src/screens/Map.tsx` (`ShareButton`), `src/screens/Level.tsx` (`Narration` above theory), `src/screens/Profile.tsx` (`ProfileBilling`, `AdminLink`, `AccountSection`, `me.email` instead of `ql.user`, logout link removed); `.gitignore` (site, native, Firebase entries from site design 4.3); `.env.mobile` (`VITE_API_BASE=https://app.questie.app`).

Stubs must be inert and typed: no UI copy beyond what the stubbed component later keeps, no TODO strings shown to users.

Done when: `npm test`, `npm run typecheck`, `npm run build` pass; `createApi({ session: fake })` serves every existing route; every route in 3.2 exists (stubs may answer 404/501 only in stub modules).

### 4.4 WP3: auth (wave B)

Goal: ACC-1..10, sign-in screens (UX 2), identity switch without wipe.

Owns: `server/auth.ts`, `server/email.ts`, `server/account.ts` (+tests), `migrations/0004_auth.sql`, `mcp/server.ts` (token), `src/auth/**`, `src/engine/sync.ts` + `sync.test.ts`.

Build:
- Better Auth on `db.sqlite` (config in backend design 2.1: email+password with verification when `RESEND_API_KEY` is set, Google, Apple with boot-time secret, `bearer()`, `magicLink` when mail is on, `apiKey`, rate limits, `cookiePrefix: "questie"`, `trustedOrigins: [APP_URL, ...APP_ORIGINS, "https://appleid.apple.com"]`, account linking trusted for google/apple, `user.deleteUser` with `beforeDelete`).
- `session` (cookie or bearer; strip cookies on `appOrigin`), `claimLegacy`, `GET /me` returning the full `Me` (`credits()` from WP4's module).
- `purgeUser` over the 3.6 table list; `beforeDelete` calls `cancelForUser` then `purgeUser`.
- Resend via `deps.fetch` (`POST https://api.resend.com/emails`); without key, log the link.
- Client: Better Auth client, token store, session store, Gate, the five auth screens (copy from UX 2), `AccountSection` (UX 10, 10.1), `switchUser(me)` keeps data when `prev in me.aliases || prev === lower(me.email)`. On native, social buttons call `src/native/social.ts` `idToken()` then `signIn.social({ provider, idToken })`; Apple hidden on Android.
- `mcp/server.ts`: send `x-api-key` from `QUESTIE_TOKEN ?? QUESTLOG_TOKEN`.

Depends: WP2. Runtime: WP4 `credits()` (stub returns null until merged).

### 4.5 WP4: credits + billing (wave B)

Goal: CRD-1..12, BIL-1..9, credits UI (UX 4).

Owns: `server/credits.ts`, `server/billing.ts` (+tests), `migrations/0005_credits.sql`, `shared/pricing.ts`, `scripts/stripe-setup.ts`, `src/billing/**`.

Build:
- Ledger and rules of 3.6; `spend` idempotency (replay, 409 conflict, in-flight set -> 409 `in_progress`); `charge` helper; `metered(env)`; billing off writes nothing.
- Stripe with the `stripe` SDK via `deps.stripe`: checkout (customer reuse, lookup-key prices cached, `automatic_tax`, `tax_id_collection`, `billing_address_collection: "required"`, `invoice_creation` for packs, URLs from 3.2 conflicts row), portal, fulfill (shared with the webhook), webhooks of 3.7, `cancelForUser` (cancel now).
- RevenueCat webhook (`timingSafeEqual` on `Authorization`).
- `GET /credits`, `GET /credits/ledger` (cursor = `created_at|id`), `POST /admin/credits`.
- `scripts/stripe-setup.ts`: products and prices from `pricing.ts`, EUR, `tax_behavior: "inclusive"`, `tax_code: "txcd_10000000"`, `lookup_key`, idempotent.
- Client: `CostButton`, `Confirm`, `TopUpSheet` (web: checkout redirect with `ql.checkout`; native: `src/native/purchases.ts`, store prices, Restore), `CreditChip`, `LowBalance`, `PlansScreen`, `BillingDoneScreen` (poll fulfill up to 20 s), `CreditsScreen` (ledger table, per-day grouping of grade/improve), `ProfileBilling` (Plan + Credits sections). Copy from UX 4, 10, 12.3.

Depends: WP2.

### 4.6 WP5: builder (wave B)

Goal: BLD-1..13, BLD-4 sandbox, runtime course registry, builder UI (UX 3, 5, 9.1, 11).

Owns: `server/jobs.ts`, `server/builder.ts`, `server/sandbox.ts`, `server/kata-child.ts`, `server/courses.ts` (+tests), `src/course/validate.ts` (runner parameter), `migrations/0006_courses.sql`, `migrations/0007_jobs.sql`, `scripts/builder-eval.ts`, `src/builder/**`, `src/course/registry.ts` (after WP2), `src/screens/Welcome.tsx`, `src/screens/Home.tsx`, `src/screens/Materials.tsx` (Sources), `src/engine/Sources.tsx`.

Build:
- Job worker: claim, heartbeat 15 s, boot recovery (`attempts < 2` requeue, else fail + refund), `JOB_CONCURRENCY`, 1 active build per user, failure refund in one `tx`, events.
- Uploads to the Anthropic Files API (`deps.anthropic`), PDF magic check, text UTF-8 <= 500 KB, 10 per job; delete Files API objects after 24 h.
- `POST /builder/jobs`: validate, topic pre-check (one `claude-haiku-5-5` call, 15 s timeout; on error skip) -> 422 `topic_too_broad { suggestions }`, then `spend(..., allowFree: mode === "topic")`, `enqueue`.
- Pipeline (backend design 8.2-8.3): `claude-opus-5-5`, shared cached system prompt (authoring skill + course JSON Schema + rules), research (web search `max_uses: BUILD.webMaxSearches`; web fetch for URLs/repos, Anthropic fetches), outline (JSON schema, `reject`), write per level in parallel, assemble (`u<10>-<slug>` id), validate with `sandboxRun`, fix loop, save. Builder rules: 3+ challenge types and not only quiz/multi, no media blocks, sources only from research URLs, every kata referenced. Error codes `build_rejected`, `build_invalid`, `too_few_sources`, `source_unreachable`, `ai_failed`.
- Sandbox: sucrase transform in the parent; child `process.execPath --permission --allow-fs-read=<dist-server/kata/kata-child.js> --max-old-space-size=128`, `env: {}`, temp `cwd`, 5 s SIGKILL, 1 MB stdout cap, `vm.runInNewContext` with only `eq` and `console`. Python: schema only. Code comment `shortcut:` for network.
- Courses: `findCourse`, `saveUserCourse`, `GET/PUT/DELETE /courses*`, `course_opens`, parsed JSON cache by `(id, version)`; `PUT` re-validates in the sandbox and keeps ids.
- Client: `BuildScreen` (tabs Topic / Files / Web research, uploads at pick time, `CostButton`), `JobScreen` (poll 2 s while visible, stage list, outline checklist, result, failure with refund line), `Welcome` (topic card + library cards, `ql.welcomed.<user>`), Home (DB courses, `JobCards`, `StatusPill`, empty state), registry loading (`ql.courses` before first render, fetch unknown course ids before NotFound), `Sources` under theory cards and on Materials.

Depends: WP2. Runtime: WP4 `spend/refund` (stub: billing off).

### 4.7 WP6: ai-meter + narration (wave B)

Goal: CRD-7..9 for grade, stronger answer, mock; NAR-1..5; UX 6, 7, 8.

Owns: `server/grading.ts`, `server/grader.ts`, `server/narration.ts`, `server/media.ts` (+tests; extract `serveFile`), `shared/narration.ts`, `migrations/0008_metering.sql`, `src/answers/**`, `src/screens/Mock.tsx`, `src/screens/Answers.tsx`, `src/narration/**`.

Build:
- `grader.ts`: grade without `improved`; `claudeImprover` returning `Improvement`; `parseGrade` accepts old and new shapes.
- `/grade` through `charge("grade")`, free with a valid `mockId` (owner, course, not expired, written challenge of that course, `grades_left--`); `/answers/:id/improve` through `charge("improve")`, saves into the answer's `grade` JSON; `/mock` debits 20, `grades_left = 2 * written boss challenges`, `expires_at = now + mock.seconds + 10 min`. Lookups through `findCourse`.
- Narration: `narrationText(card)`, hash cache, ElevenLabs `POST /v1/text-to-speech/{voice}?output_format=mp3_44100_128` via `deps.fetch`, split > 9,000 chars with `previous_text`/`next_text`, single-flight per hash, temp file + rename; unlock charged once per user + course + level + voice; `narration` job handler via `registerJob`; failure refunds and removes the unlock; audio route checks the unlock, Range, cache headers.
- Client: `WrittenAnswer` phases with `CostButton` (`Grade · 2`, `Stronger answer · 3`), 402 back to edit, `Idempotency-Key` per action, `mockId` forwarding; `GradeView` corrections; Answers shows stronger answers; Mock start with `Start · 20` and session resume from `ql.mock.<course>`; `Narration` player (per-card segments, speed cycle, Space toggle, Media Session metadata on web, bearer blob URLs on native).

Depends: WP2. Runtime: WP4 `charge`, WP5 `registerJob`/`findCourse` (stubs until merged).

### 4.8 WP7: library (wave B)

Goal: LIB-1..7, BLD-14, UX 5.7, 9.2-9.4.

Owns: `server/library.ts` (+test), `migrations/0009_library.sql`, `scripts/export-course.ts`, `src/library/**`, `src/screens/Library.tsx`.

Build: share/publish/unpublish transitions on `user_courses`; `GET /library` (author from `user.name`); flags with per-item counts; admin review, approve (`published_at`), reject (`review_note`), resolve flag; `scripts/export-course.ts <id>` writes `courses/<id>/course.json`. Client: `ShareButton` + share dialog (copy link uses `${APP_URL}/c/<id>`, submit confirm with "Published under CC BY 4.0."), `StatusPill`, `ReportButton` dialog, `QueueScreen` (Pending/Reports tabs, approve after 5 s undo window, reject reason), `AdminLink`, Library screen (bundled + public user courses, client search, filters).

Depends: WP2 (the `user_courses` table comes from WP2's copy of `0006`).

### 4.9 WP8: site (wave B)

Goal: WEB-1..5, LIC-7, docs, demo.

Owns: `site/**` except `site/src/content/docs/self-host/**`; `scripts/schema-ref.ts` + `scripts/schema-ref.test.ts`; `.github/workflows/site.yml` (build on `pull_request`, build + Pages deploy on push to `main`).

Build: everything in site design section 1 (layout, landing, docs IA, generated schema reference and JSON Schema, pricing from `shared/pricing.ts`, demo build at `/demo/` via `npm run site:demo`). Copy follows the owner's marketing rules (load `confident-copy` before writing landing or pricing copy): no "unlimited", no "beta", no limitations section. Domain and repo from `shared/brand.ts`.

Depends: WP2 (`pricing.ts`, `brand.ts`, `sources` in the schema, site scripts).

### 4.10 WP9: ops (wave B)

Goal: OPS-1..6, REN-3/REN-4 deploy safety, runbook.

Owns: `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `fly.toml`, `litestream.yml`, `scripts/entrypoint.sh`, `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`, `README.md` (deploy and env sections), `site/src/content/docs/self-host/**` (docker, fly, config, backups, upgrade, export).

Build: site design section 3 with these fixes: compose `name: questie`, `container_name: questie`, `env_file`, `COMMIT` build arg, no proxy-header env; `deploy.yml` runs `docker compose -p questlog down --remove-orphans || true` before `up`, keeps `runs-on: [self-hosted, questlog]` and `BOX`, passes `ENV_FILE` and `COMMIT`, health check without the proxy header, logs `docker logs questie`; Dockerfile: Litestream 0.5 stage pinned by digest, `ENTRYPOINT ["scripts/entrypoint.sh"]`, `DB_PATH=/data/questlog.db`, `ARG COMMIT`. `ci.yml`: add a `docker build` smoke job. Runbook includes the owner steps: relabel the runner, then change `runs-on`; set the new `.env` vars on the box before the first deploy.

Depends: WP1; env names from this file.

### 4.11 WP10: mobile (wave B)

Goal: MOB-1..7, native push, RevenueCat client, store rules.

Owns: `capacitor.config.ts`, `ios/**`, `android/**`, `resources/**`, `src/native/**`, `public/.well-known/**`, `server/devices.ts`, `server/fcm.ts`, `server/reminders.ts` (+tests), `migrations/0010_devices.sql`, `src/engine/push.ts`, `src/ui/global.css` and `src/engine/engine.css` (safe-area rules only), `index.html` (`viewport-fit=cover`), `.github/workflows/mobile.yml` (`cap:sync` + `./gradlew assembleDebug` on Linux).

Build: site design section 4 and frontend 9 with these choices: `appId` from `shared/brand.ts`; secure token store registered in `init()`; native Google/Apple ID tokens via `@capgo/capacitor-social-login` (`VITE_GOOGLE_*`), Apple only on iOS; RevenueCat `configure` with `appUserID = me.user` on sign-in, `logOut` on sign-out, offerings mapped to `CheckoutItem`; FCM via `@capacitor-firebase/messaging`, `POST /push/device`; server FCM HTTP v1 sender (service-account JWT via `node:crypto`, `deps.fetch`) beside Web Push in `runReminders`, dropping dead tokens on `UNREGISTERED`; back button, `appUrlOpen` (magic link, `/c/<id>`); AASA and `assetlinks.json`; Info.plist (`UIBackgroundModes: audio, remote-notification`, microphone text), Android permissions. Stripe links never shown on native.

Depends: WP2.

### 4.12 WP11: integration + E2E (wave C)

Merges wave B, removes any leftover stub behavior, runs the full verification of the plan, and adds `e2e/questie.spec.ts` (Playwright) against `server/e2e.ts`: an entry that builds `createApi` with fake Anthropic, ElevenLabs, Resend and FCM clients and real Stripe test mode. Flow: sign up -> free topic course -> subscribe (Stripe test card, `stripe listen` forwarding) -> credits granted -> build from a PDF -> grade an answer -> publish -> admin approves -> course in Library. Also checks a legacy browser (`questlog-v1` + `ql.user` = email) keeps progress after first sign-in.

Owns: `e2e/**`, `server/e2e.ts`, `playwright.config.ts`, and fix-ups anywhere after wave B merges (one engineer, so no conflicts).

## 5. Test plan

All server tests use `memoryDb` and `createApi(deps)` with fakes; no network. Client tests are pure logic (vitest `node` env, `localStorage` stub as in `sync.test.ts`).

| WP | Unit tests | Mocks |
|---|---|---|
| WP1 | `store.test.ts`: old key only -> loaded and copied; both keys -> new wins; legacy key still migrates. `Questie` key fallback. MCP env fallbacks (`mcp/courses.test.ts`). `npm run validate`, `reuse lint` | none |
| WP2 | `db.test.ts`: `tx` commits, rolls back on throw, WAL on; `api.test.ts`: mount order (`/health`, `/auth/*`, `/webhooks/*` reachable without session and from cross-site), guard (cross-site 403, `APP_ORIGINS` allowed, multipart only on uploads), body limits, error `code` shape, named-column inserts, existing routes and isolation via fake session; `route.test.ts`: new hashes, hash query; `courses.test.ts`: `registerCourses` skips invalid and bundled ids, replaces, fills `CHALLENGES`; `env.test.ts`: boot checks | fake `session` |
| WP3 | Session via cookie and via bearer; app-origin request ignores cookies; `claimLegacy`: verified email moves five tables, unverified does not, `local`/`''` to first account only, PK collision keeps both rows, idempotent across restart; `/me` aliases and features; `purgeUser` empties every listed table; `SIGNUP=closed`; `sync.test.ts`: email -> id and alias -> id keep data, id A -> id B wipes; session store 200 / 401 / network with and without cache | real Better Auth on `memoryDb` (verification off); Resend: `deps.fetch` fake asserting one POST; Google/Apple not called |
| WP4 | Ledger: idempotent spend (replay, conflict, in-flight), concurrent spends never overdraw, plan-first split, refund mirrors once, plan reset on grant, lazy expiry once, free course once and restored on refund, balance cache equals ledger sums after every op, billing off writes nothing; Stripe: bad signature 400, duplicate event no double grant, `invoice.paid` grant, pack via webhook and via fulfill grants once, out-of-order subscription events, `charge.refunded`; RevenueCat: bad auth 401, plan, pack, store refund, duplicate `event.id`, unknown user 200; checkout params (tax, lookup keys, `already_subscribed`); `CostButton` label logic; 402 opens top-up once | Stripe: events signed with `stripe.webhooks.generateTestHeaderString`; `deps.stripe` fake object for `customers`, `prices`, `checkout.sessions`, `billingPortal.sessions`, `subscriptions`; RevenueCat: JSON fixtures |
| WP5 | Jobs: claim, heartbeat recovery, failure refund in one tx, 1-build limit, events after `seq`; uploads: type, size, count; pre-check 422 charges nothing; pipeline per mode happy path; outline reject refunds; fix loop repairs one level; exhausted fix loop refunds; MCQ-only rejected; invented source URL rejected; `< 3` sources fails; course id shape; courses access rule per status, `course_opens`, `PUT` validation and version bump; sandbox (real child): kata reading `process.env`, opening a file, looping forever, allocating without bound each fail cleanly, valid kata passes; `machine.test.ts` for every builder transition; registry loading with cache | Anthropic: `deps.anthropic` fake with scripted `messages.create`, `messages.stream().finalMessage()`, `files.upload/delete` responses queued per call; credits real module on `memoryDb` |
| WP6 | `/grade` 402 before the model call; refund on grader failure (502 `refunded: true`); mock debits once, grades free until expiry (410) or cap (409); improve charges 3, saves into the answer, second improve 409; old saved grades parse; narration: charge once per user + lesson + voice, cached audio skips the job, audio route requires an unlock, job failure refunds and removes the unlock, chunk split, single-flight; `serveFile` Range | grader/improver fakes as today; ElevenLabs: `deps.fetch` fake returning MP3 bytes, asserting `xi-api-key` and body; jobs real module |
| WP7 | Transitions (`share`, `publish`, `unpublish`, approve, reject) and illegal ones 409/403; non-admin 403; library order and author; flags counts and resolve; export script writes valid JSON | none |
| WP8 | `schema-ref.test.ts`: every challenge type and theory kind in the reference; every `json challenge` / `json block` / `json kata` fence in authoring docs validates; `npm run site:build` produces index, pricing, reference, `schema/course.json`, `demo/index.html` | none |
| WP9 | `docker build`; container starts without `LITESTREAM_BUCKET`; with MinIO: write data, delete volume, restart, data restored; `/api/health` without headers | MinIO container |
| WP10 | `devices` routes (own tokens only); FCM sender: JWT claims, payload, dead-token cleanup; `runReminders` sends to both web and native; `purchases.ts` offering mapping; `appUrlOpen` routing; `cap:sync` + `assembleDebug` in `mobile.yml` | FCM: `deps.fetch` fake + test RSA key; Capacitor plugins: `vi.mock` per module |
| WP11 | Playwright E2E above; full `npm test`, `npm run typecheck`, `npm run validate`, `npm run site:build`, `npm run cap:sync` | Anthropic, ElevenLabs, Resend, FCM fakes in `server/e2e.ts`; Stripe test mode |

Every wave B UI diff is checked against the UI copy rules before merge: short, imperative, no description under titles; strings from the UX copy index.

## 6. Open questions

None block the build. External inputs the owner supplies before wave C, not decisions:

- Stripe test-mode keys and a webhook secret (E2E), then live keys with Stripe Tax registrations.
- RevenueCat project, App Store Connect and Play products with the ids in 3.4, Firebase project files, Google and Apple OAuth clients.
- iOS builds, Apple sign-in, APNs and StoreKit need macOS; on Linux only Android is verified (site design 4.5).
- Final review of `CLA.md` before the CLA workflow is required in branch protection.
