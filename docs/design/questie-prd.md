# Questie: PRD

Product requirements for the build in `questie-plan.md`. Every decision in the plan, including "Coordinator decisions after research", is final and is restated here as a requirement, not reopened.

Sources, cited inline:

| Tag | File |
|---|---|
| [plan] | `questie-plan.md` (Decisions, Follow-up answers, Scope, Coordinator decisions) |
| [comp §n] | `questie-competitors.md`, section n |
| [comm §n.m] | `questie-community.md`, section n, row or item m |
| [code §n] / [code R n] | `questie-codebase.md`, section n / ranked risk n |

Written 2026-11-22.

## 1. Problem

Technical self-learners have two kinds of tools, and each misses half the job.

- **AI course generators** (Oboe, NerdSip, Gauth, Coursebox) turn a prompt into a course in seconds, but output is mostly MCQ and swipe cards, sources are missing or unverifiable, and quality varies [comp §1]. Oboe's top complaint is no citations [comp §1]; reviewers call Coursebox quizzes basic and NerdSip less polished than human-written [comp §1].
- **Source-based tools** (NotebookLM) make flashcards and quizzes from your material but have no spaced repetition, no export and no right/wrong marking on cards [comm §2.2, §2.3, §2.8].
- **Gamified apps** (Duolingo, Gizmo) keep people coming back with lives, energy and streak pressure that users read as coercion, and that lock practice behind a paywall [comm §1.3, §1.4].

The target communities distrust AI study material by default: r/Anki bans low-effort AI posts, and checking AI cards "wouldn't take much longer than making a card" [comm §1.1]. They also ask "why not just ask a chatbot?" [comm §1.7].

Questie already has what a chatbot and the generators lack: 12 challenge types and arcade games, runnable katas, code traces and request flows, AI-graded written answers, FSRS review, schema-validated courses, an open file format and MCP authoring [plan, Competitive research]. Today it is a single-owner, proxy-login app with courses compiled into the bundle [code R5, §3]. This effort turns it into an open-source, self-hostable app plus a hosted SaaS where AI builds courses from a topic, your own files, or cited web research, and every course feeds the same games, katas and review queue.

## 2. Target users

| Priority | Who | What they need | Evidence |
|---|---|---|---|
| 1 | **Technical self-learners**: developers learning a language, framework or protocol, or preparing for interviews | Depth over info-tainment; practice that transfers to real skill; running code, not only MCQ; level-appropriate content | [plan] first audience; [comm §1.5] "info-tainment" and no transfer; [comm §1.8] learning to code while AI writes code; [comm §2.7] level fit |
| 2 | **Self-hosters** | Run without our servers, bring their own API key, export everything, clear license | [comm §2.3], [comm §5.5], [comm §6.11] |
| 3 | **Course authors and contributors** (Claude Code / MCP users, community PR authors) | A documented, stable schema; validation in CI; clear contribution terms | [plan] scope 8, 9; [code §8]; [comm §5.3] |
| 4 | **Mobile learners** (same users, on the phone) | Review and narrated lessons on iOS/Android, one balance across web and app | [plan] scope 11; [comp §4] one ledger |

Not first: language learners and K-12. No plan decision targets them; the research on them is used only for what to avoid.

## 3. User stories

Self-learner
- As a learner, I pick a topic and level and get a full course with theory, mixed challenge types and katas, so I can start in minutes.
- As a learner, I upload a PDF or my notes (or give a URL or repo) and get a course built from that material, so I study what I actually need.
- As a learner, I ask for a web-research course and every theory card links to its sources, so I can check claims.
- As a learner, I see the credit cost on every AI button and confirm big spends, so nothing surprises me.
- As a learner, I get a failed build refunded automatically and see the refund in my history.
- As a learner, I write an answer, get a score with key points hit and missed, and pay for a stronger answer only when I want one.
- As a learner, I take a timed mock exam for one fixed price.
- As a learner, I listen to a lesson narrated, and replaying it costs nothing.
- As a learner, everything that is not AI (library courses, games, katas, SRS, notes) stays free with no lives-based paywall or energy.
- As a learner, my progress survives the rename, the move to accounts, and course updates.
- As a free user, I build one AI course from a topic before deciding to pay.

Subscriber
- As a subscriber, I pay EUR 11.99 a month (tax included), get 1,000 credits each month, top up when I run low, and manage or cancel in the Stripe portal.
- As a subscriber on mobile, I buy credits in-app and see the same balance on the web.

Author and contributor
- As a learner, I publish a course I built; anyone with the link can open it right away, and it enters the public library after review.
- As a contributor, I open a PR with a course and CI tells me whether it validates.
- As an author, I find the schema, every challenge type, the MCP server and the Claude Code plugin documented on one site.

Self-hoster
- As a self-hoster, I run one container with my own `ANTHROPIC_API_KEY`, sign in with Better Auth, and use every AI feature unmetered with no Stripe keys.
- As a self-hoster, I back up and restore my database with Litestream following the docs.

Admin
- As the owner, I approve or reject published courses from a review queue.
- As the owner, I redeploy after the rename without losing the live database or the deploy pipeline.

## 4. Success metrics

Launch gates are pass/fail and come from the plan's verification and the risks in the research. Product metrics have no researched baseline; they are measured from beta day one and targets are set after the first 30 days.

### Launch gates

| Gate | Pass condition | Source |
|---|---|---|
| Verification suite | `npm test`, `npm run typecheck`, `npm run validate` green; site builds; Capacitor sync works | [plan] Verification |
| End-to-end flow | Sign up -> free AI course -> subscribe (Stripe test mode) -> credits granted -> course from PDF -> grade answer -> publish to review queue -> admin approves -> appears in library | [plan] Verification |
| No progress loss | Existing browser progress (`questlog-v1`) and server rows (keyed by email) survive rename + first sign-in | [code R3, §2, §3] |
| No deploy break | Live DB file, compose project, runner label and health check keep working through the rename | [code R4], [plan] Coordinator decisions |
| Ledger correctness | Duplicate webhooks never double-grant; concurrent spends never overdraw; every failed AI job has a refund row | [comp §4], [comm §4.7], [comm §6.8] |
| Citations | 100% of theory cards in web-research courses carry source links | [plan] Coordinator decisions |
| Sandbox | No user-influenced course code runs in the server process | [code R1], [plan] Coordinator decisions |

### Product metrics (measure from beta)

| Metric | Why | Source |
|---|---|---|
| Builder first-pass `validateCourse` rate and fix-loop success rate, per prompt version, on a fixed topic set | Quality gate for AI courses; avoids "vibes-based" tuning | [comp §1] Khan evals |
| Rubric score of built courses on the same fixed topic set | Same | [comp §1] |
| Share of built courses using 3+ challenge types | Counters the "MCQ-only" weakness of competitors | [comp §1] Avoid |
| Build failure (refund) rate by source mode | Cost and trust | [plan] scope 5 |
| Flags per 100 lessons | Accuracy signal; feeds review queue | [comp §1] report-a-problem, [comm §6.2] |
| Free course -> subscription conversion | Tests the one-free-course trial | [plan] Free tier |
| Credits spent per subscriber per month vs 1,000 granted | Checks the credit table against use | [plan] Follow-up answers |
| Day-7 and day-30 SRS review activity among users with an AI course | Shows AI courses feed real practice, not one-off reads | [comm §2.2] |
| Gross margin per action (model + search + TTS cost vs credit price) | Keeps 200-credit web builds profitable | [comp §1] `max_uses` |
| Billing support tickets per 100 subscribers | Cursor's backlash came from unclear rules, not price | [comm §4.1, §4.2] |

## 5. Requirements

Priority: **Must** ships in this effort; **Should** ships unless it blocks a Must; **Won't** is out of scope for this effort.

### 5.1 Rename (Questlog -> Questie)

| ID | Priority | Requirement | Source |
|---|---|---|---|
| REN-1 | Must | Rename across package, UI, `<title>`, manifest, service worker, plugin, MCP, docs, Docker | [plan] scope 1, [code §2] |
| REN-2 | Must | Read the old `questlog-v1` localStorage key when the new key is missing; update the `switchUser` wipe list | [code §2] store.ts row |
| REN-3 | Must | Keep `questlog.db` working: keep the filename, or rename on startup only when the old file exists and the new one does not | [code R4], [plan] Coordinator decisions |
| REN-4 | Must | Compose project, container name, runner label and deploy workflow migrate without a port conflict or a stuck job (old project brought down first, runner relabelled first) | [code R4] |
| REN-5 | Must | Accept both `QUESTIE_*` and `QUESTLOG_*` env names (`_COURSES`, `_URL`) | [code §2] |
| REN-6 | Must | Keep `questlog/authoring` as an alias next to `questie/authoring` so external course repos keep building | [code R7] |
| REN-7 | Should | Docs tell plugin users to re-add the marketplace and reinstall; MCP URIs renamed with a note | [code §2] |
| REN-8 | Won't | Rename the internal `ql.` storage prefix | [code §2] "costs nothing" |

### 5.2 Licensing and contributions

| ID | Priority | Requirement | Source |
|---|---|---|---|
| LIC-1 | Must | `LICENSE` at root is AGPL-3.0 for the app | [plan] License |
| LIC-2 | Must | Course format (schema + authoring SDK) under MIT, in a clearly marked package/path | [plan] License, scope 2 |
| LIC-3 | Must | `courses/` under CC-BY-4.0 | [plan] License |
| LIC-4 | Must | NOTICE and a README section explain the split | [plan] scope 2 |
| LIC-5 | Must | App code PRs require a CLA via CLA Assistant | [plan] Coordinator decisions |
| LIC-6 | Must | Library course PRs require DCO sign-off | [plan] Coordinator decisions |
| LIC-7 | Must | Pricing and license are stated on the landing page, pricing page and README | [comm §2.4], [comm §5.7] r/Anki Rule 3 |
| LIC-8 | Should | Self-hosting docs show data export and running with no Questie servers | [comm §2.3], [comm §6.11] |

### 5.3 Accounts

| ID | Priority | Requirement | Source |
|---|---|---|---|
| ACC-1 | Must | Better Auth inside the app, one mode for SaaS and self-host; remove `USER_HEADER`, `NAME_HEADER`, `LOGOUT_URL` | [plan] Sign-in, Follow-up answers |
| ACC-2 | Must | Email + password, Google, Apple | [plan] scope 3 |
| ACC-3 | Should | Magic link | [plan] scope 3 ("optional") |
| ACC-4 | Must | Sessions in SQLite via `node:sqlite`; Better Auth tables created by a committed migration, not auto-migrate | [plan] scope 3, [code §5] |
| ACC-5 | Must | Cookies on web; bearer tokens for Capacitor, exposed via `set-auth-token` in CORS | [plan] scope 3, [comp §3] |
| ACC-6 | Must | Auth handler and OAuth callbacks (including Apple's cross-site POST) mounted outside `guard`; `/api/health` public | [code R2, R4] |
| ACC-7 | Must | Existing per-user data (keyed by lowercased email) attaches to the account with that email on first sign-in; self-host `"local"` data goes to the first account | [plan] scope 3, [code §3] |
| ACC-8 | Must | Signing in never triggers the client progress wipe for a migrated user | [code R3] |
| ACC-9 | Must | Profile shows name/email and signs out through Better Auth | [code §3] |
| ACC-10 | Should | API token for MCP note tools, replacing `QUESTLOG_HEADERS` | [code §2] mcp row |

### 5.4 Billing

| ID | Priority | Requirement | Source |
|---|---|---|---|
| BIL-1 | Must | Stripe Checkout for the EUR 11.99/month subscription and both top-up packs | [plan] scope 4 |
| BIL-2 | Must | Stripe Tax on; EUR prices tax-inclusive so the user pays the listed price; tax behavior set before prices are created | [plan] Web payments, [comp §4] |
| BIL-3 | Must | Stripe Customer Portal for cancel and invoices | [plan] scope 4, [comp §4] |
| BIL-4 | Must | Monthly grant on `invoice.paid`; packs on `checkout.session.completed` with `payment_status=paid` or `async_payment_succeeded`; one `fulfill` used by webhook and success page | [comp §4] |
| BIL-5 | Must | Webhooks mounted before `auth`, verified on raw body, deduped by event id; no reliance on event order | [code R2], [comp §4] |
| BIL-6 | Must | RevenueCat webhook: verify `Authorization` header, dedupe on `event.id`, `NON_RENEWING_PURCHASE` -> pack, `INITIAL_PURCHASE`/`RENEWAL` -> monthly grant, pack `CANCELLATION` -> negative row; same ledger as Stripe | [plan] scope 4, [comp §4] |
| BIL-7 | Must | Billing off and AI unmetered when Stripe keys are not set | [plan] Follow-up answers |
| BIL-8 | Won't | Stripe Billing Credits, RevenueCat In-App Currency | [comp §4] own ledger |
| BIL-9 | Won't | Auto top-up | [comp §2] Avoid |

### 5.5 Credits

| ID | Priority | Requirement | Source |
|---|---|---|---|
| CRD-1 | Must | Append-only ledger with a unique source key per row (grant, pack, spend, refund); balance derived from it | [plan] scope 5, [comp §4], [code §5] |
| CRD-2 | Must | Plan credits reset each billing month, no rollover; top-up credits never expire; plan credits spent first | [plan] Coordinator decisions |
| CRD-3 | Must | Spend is atomic with an idempotency key (reserve before the AI call, settle after); return 402 before calling the model when short | [plan] scope 5, [comm §4.7], [code R8] |
| CRD-4 | Must | Automatic refund, shown as a ledger row, when an AI job fails | [plan] scope 5, Coordinator decisions |
| CRD-5 | Must | Credit cost shown on every AI button; confirm before spends of 100+ | [plan] Coordinator decisions |
| CRD-6 | Must | All prices, grants and pack sizes in one config module | [plan] Follow-up answers |
| CRD-7 | Must | Metered: course builds (three modes), Grade, Stronger answer + corrections, mock exam, narration. Nothing else | [plan] scope 5 |
| CRD-8 | Must | Grade (score, key points hit/missed, feedback) = 2 and Stronger answer + corrections = 3 are separate actions; the second is offered only after a grade | [plan] Coordinator decisions, [code R10] |
| CRD-9 | Must | A mock exam debits 20 once per session; grading inside that session is not charged again | [code R9] |
| CRD-10 | Must | Balance and ledger history on Profile, each row naming the action | [comp §2] |
| CRD-11 | Should | One low-balance warning; a 402 opens the top-up sheet | [comp §2] |
| CRD-12 | Should | Credit cost changes are announced in-app before they apply | [comp §2], [comm §4.1] |
| CRD-13 | Won't | The word "unlimited" anywhere in pricing copy | [comp §2], [comm §4] Perplexity |

### 5.6 AI course builder

Three source modes, all through one pipeline: outline -> write -> `validateCourse` -> fix loop -> save as the user's private course, run as a background job with progress UI [plan] scope 6.

| ID | Priority | Requirement | Source |
|---|---|---|---|
| BLD-1 | Must | **Topic + level** mode, 100 credits; one free topic course per free user | [plan] Follow-up answers |
| BLD-2 | Must | **Files** mode: uploaded PDFs and notes, plus URL or repo, 150 credits; uploads use their own route, not the 256 KB JSON limit | [plan] scope 6, [code R2] |
| BLD-3 | Must | **Web research** mode via the Anthropic web search tool, 200 credits; every theory card carries source links; `max_uses` caps searches per build | [plan] scope 6, Coordinator decisions, [comp §1] |
| BLD-4 | Must | Validation runs sandboxed: no in-process `new Function` or `python3` on user-influenced content; kata checks in a worker or child process with time and memory limits, or static validation with katas run client-side | [plan] Coordinator decisions, [code R1] |
| BLD-5 | Must | User courses stored in the DB and loaded at runtime on client and server; private courses and their media served only through auth | [plan] Coordinator decisions, [code R5, R6] |
| BLD-6 | Must | Generated course ids globally unique (progress keys are `<course>:<id>`) | [code §6] |
| BLD-7 | Must | Debit at enqueue, refund on failure; job progress visible and survives a page reload | [plan] scope 6, [code §4] |
| BLD-8 | Must | Fix loop rejects courses that use only MCQ | [comp §1] Avoid |
| BLD-9 | Should | Outline shown in the progress UI; no approval gate before writing topic courses | [comp §1] Borrow |
| BLD-10 | Should | One-word or vague topics are expanded or rejected before credits are spent | [comm §6.3] |
| BLD-11 | Should | Levels written in parallel after the outline is fixed | [comp §1] |
| BLD-12 | Should | Rebuilding or updating a course keeps progress on unchanged items (stable ids) | [comm §1.6], [comm §6.9] |
| BLD-13 | Should | Eval harness: fixed topic set, `validateCourse` pass rate and rubric score per prompt version | [comp §1] |
| BLD-14 | Should | Report-a-problem on each lesson and challenge | [comp §1], [comm §6.2] |

### 5.7 Narrated lessons

| ID | Priority | Requirement | Source |
|---|---|---|---|
| NAR-1 | Must | ElevenLabs TTS, 10 credits per lesson | [plan] Follow-up answers |
| NAR-2 | Must | Audio cached per lesson + voice; a user is never charged twice for the same lesson + voice | [plan] Follow-up answers |
| NAR-3 | Must | Self-hosters enable narration with an optional `ELEVENLABS_API_KEY`; feature hidden without it | [plan] Follow-up answers |
| NAR-4 | Must | Narration plays on web and in the mobile apps | [plan] scope 11 |
| NAR-5 | Must | Audio for private courses served only through auth | [code R6] |

### 5.8 Library and review queue

| ID | Priority | Requirement | Source |
|---|---|---|---|
| LIB-1 | Must | Every library course free for every user | [plan] Free tier |
| LIB-2 | Must | Owner-built library courses: built with AI, reviewed before release | [plan] Library courses |
| LIB-3 | Must | `CONTRIBUTING.md` and CI that runs `npm run validate` on course PRs | [plan] scope 8, [code §8] |
| LIB-4 | Must | Users publish their own AI-built courses: visible by link immediately, enters the public library after owner/admin approval | [plan] Follow-up answers |
| LIB-5 | Must | Admin queue to approve or reject; states private -> link -> pending -> public or rejected | [plan] scope 8, [code §5, §6] |
| LIB-6 | Should | Flags from report-a-problem appear in the admin queue | [comp §1] |
| LIB-7 | Should | Approved user courses can be exported to `courses/` by PR | [code §6] |

### 5.9 Website and docs

| ID | Priority | Requirement | Source |
|---|---|---|---|
| WEB-1 | Must | One Astro Starlight site in `site/`: landing (splash + hero with mascot), pricing, docs | [plan] scope 9, [comp §5] |
| WEB-2 | Must | Docs for learners, course authoring (schema reference, challenge types, MCP, Claude Code plugin), self-hosting, contributing | [plan] scope 9 |
| WEB-3 | Must | Pricing page shows the full credit table (section 6) and the license split | [comp §2], [comm §2.4] |
| WEB-4 | Must | Site build runs in CI | [plan] Verification, [code §8] |
| WEB-5 | Should | Landing leads with what a chatbot can't do: FSRS review, graded written answers, runnable katas, schema-validated courses, citations | [comm §6.1], [comm §1.7] |
| WEB-6 | Won't | A separate landing app outside Starlight | [comp §5] |

### 5.10 Ops

| ID | Priority | Requirement | Source |
|---|---|---|---|
| OPS-1 | Must | Same container on Fly or a VPS; SQLite via `node:sqlite` | [plan] Hosting |
| OPS-2 | Must | Litestream in the image: restore if missing, then `replicate -exec` the server | [plan] scope 10, [comp §6] |
| OPS-3 | Must | `journal_mode=WAL` and `busy_timeout=5000` in `openDb`; no app-side checkpoints | [comp §6], [code §5] |
| OPS-4 | Must | `fly.toml` and VPS compose; only replica URL and keys differ | [plan] scope 10, [comp §6] |
| OPS-5 | Must | Docs: backup, point-in-time restore, delete-volume-and-redeploy drill, env reference | [plan] scope 10, [comp §6] |
| OPS-6 | Must | One writer per database | [comp §6] |
| OPS-7 | Won't | Horizontal scaling or a second database engine | [plan] Hosting |

### 5.11 Mobile

| ID | Priority | Requirement | Source |
|---|---|---|---|
| MOB-1 | Must | Capacitor iOS and Android projects wrapping the web app, with a configurable API base URL | [plan] scope 11, [code §7] |
| MOB-2 | Must | In-app auth with bearer tokens in Keychain/Keystore; Capacitor origins trusted; no reliance on WebView cookies | [comp §3], [code R2] |
| MOB-3 | Must | Native Google and Apple sign-in via ID token | [comp §3] |
| MOB-4 | Must | Credit purchases through RevenueCat in-app purchase, landing in the shared ledger | [plan] scope 4, 11 |
| MOB-5 | Must | Reminders via native push (APNs/FCM) with a device token table; Web Push stays for the PWA | [plan] scope 11, [code §7] |
| MOB-6 | Must | Narrated audio playback | [plan] scope 11 |
| MOB-7 | Should | Reminders only at times the user sets; no "streak at risk" pushes | [comm §1.9], [comm §6.5] |

### 5.12 Cross-cutting

| ID | Priority | Requirement | Source |
|---|---|---|---|
| X-1 | Must | Practice (games, katas, SRS, notes, library) never costs credits | [plan] Free tier, [comm §6.4] |
| X-2 | Must | Lives stay an in-level mechanic, never refilled by payment or a timer | [comm §1.4], [comm §2.5] |
| X-3 | Should | Timed games and challenges offer a screen-reader path or a skip | [comm §2.9], [comm §6.12] |
| X-4 | Should | Test seams: builder, narration and billing clients injected like `createApi({ grader })` | [code §4] |

## 6. Credits and pricing

All values live in one config module and can be tuned [plan]. Prices are EUR, tax-inclusive [comp §4].

### Plans and packs

| Item | Price | Credits | EUR per 100 credits | Notes |
|---|---|---|---|---|
| Free | 0 | 0 | - | Library, games, katas, SRS, notes; one free topic course; self-host with own key |
| Plan | 11.99 / month | 1,000 / month | 1.20 | Resets each billing month, no rollover |
| Top-up S | 5.99 | 500 | 1.20 | Never expires |
| Top-up L | 14.99 | 1,500 | 1.00 | Never expires |

Spend order: plan credits first, then top-ups [plan] Coordinator decisions.

### Action costs

| Action | Credits | EUR at plan rate | Per 1,000-credit month |
|---|---|---|---|
| Course from topic + level | 100 | 1.20 | 10 |
| Course from files, notes, URL or repo | 150 | 1.80 | 6 |
| Course from web research (with citations) | 200 | 2.40 | 5 |
| Grade a written answer | 2 | 0.02 | 500 |
| Stronger answer + corrections (after a grade) | 3 | 0.04 | 333 |
| Mock exam | 20 | 0.24 | 50 |
| Narrated lesson (per lesson + voice, once) | 10 | 0.12 | 100 |

EUR columns are derived from 1,000 credits = EUR 11.99 and rounded.

Self-host: no Stripe keys means no metering; the user's own Anthropic and ElevenLabs keys pay the model costs [plan].

## 7. Non-goals

- Lives, hearts or energy as a paywall; credits on any non-AI feature [comm §1.4], [comm §6.4].
- Rollover of plan credits [plan] Coordinator decisions.
- Auto top-up, Stripe Billing Credits, RevenueCat In-App Currency [comp §2, §4].
- "Unlimited" plans or copy [comp §2].
- An approval gate before a topic course is written [comp §1].
- The proxy-header login mode [plan] Follow-up answers.
- Multi-writer databases or a second database engine [plan], [comp §6].
- Silent streak freezes or guilt-based notifications [comm §6.5].
- Language-learning or K-12 positioning in this effort [plan] First audience.

## 8. Risks

| Risk | Impact | Mitigation in this PRD | Source |
|---|---|---|---|
| "AI course" reads as a negative in r/Anki and similar communities | Launch posts removed or ignored | Lead with FSRS, graded answers, katas, schema validation, citations; state price and license in every post | [comm §1.1, §6.1], WEB-5, LIC-7 |
| Topic-only courses have no source to check | Accuracy complaints | Report-a-problem, review before library entry, web-research mode for cited content | [comm §6.2], BLD-14, LIB-4 |
| Model-written kata code runs on the server | Exposure of API keys, Stripe secret, filesystem | Sandboxed validation | [code R1], BLD-4 |
| Identity change wipes local progress | Data loss for every existing browser | Keep `/me.user` stable for migrated users or map old to new | [code R3], ACC-8 |
| Rename breaks the live deploy | Empty DB, port conflict, stuck deploy job | Filename fallback, old project down, runner relabel, public health check | [code R4], REN-3, REN-4 |
| Unclear credit rules | Cursor-style backlash and refunds | Cost on every button, confirm 100+, ledger history, announce changes | [comm §4.1, §4.2], CRD-5, CRD-12 |
| Concurrent requests double-spend | Negative balances, lost margin | Reserve-then-settle with idempotency key | [comm §4.7], CRD-3 |
| Web search cost per build | 200-credit builds lose money | `max_uses` cap per build; track margin per action | [comp §1], BLD-3 |
| CLA draws rug-pull distrust | Fewer contributors to the app | DCO for courses; MIT format and CC-BY courses keep the content open | [comm §5.3, §6.10], LIC-5, LIC-6 |
| Cookies do not persist in iOS WebView | Users signed out on mobile | Bearer tokens in secure storage | [comp §3], MOB-2 |
| Course rebuilds wipe progress | The highest-scoring complaint found (1,085 points) | Stable ids across versions | [comm §1.6], BLD-12 |
| Better Auth with `node:sqlite` `DatabaseSync` not verified | Adapter work needed | Check early; adapter over `server/db.ts` if needed | [code §5], [comp §3] |
| Top-up L costs less per credit than the plan | Users may prefer packs over the subscription if packs are sold without one | Settle open question 3 | Section 6 |
| Timed games block screen-reader users | Public accessibility complaints | Skip or screen-reader path | [comm §2.9], X-3 |

## 9. Open questions

1. Use the Better Auth Stripe plugin for customer and subscription state, or own webhook code for everything? The ledger stays our own code either way [comp §3, open questions].
2. When another user already generated a lesson's narration in the same voice, does playing the cached audio cost 10 credits or nothing? The plan says "a lesson is paid once" [plan]; the codebase map proposes debit only on a cache miss [code §4].
3. Can free users buy top-up packs without a subscription? The plan pairs packs with the subscription but does not say.
4. On iOS and Android, are both the subscription and packs sold in-app, and at what store prices? RevenueCat handling for both is specified [comp §4]; store pricing is not.
5. Key user data by lowercased email (no data migration; an email change orphans data) or by Better Auth user id (needs the old-to-new mapping in the client)? [code §3, R3]
6. Contribution terms for the MIT course format package: CLA like app code, or DCO like courses? [plan] Coordinator decisions cover app code and library courses only.
7. Can users edit a generated card or question, or only flag it? [comm §6.2]
8. How are admins assigned for the review queue (role in Better Auth, env allowlist)?
