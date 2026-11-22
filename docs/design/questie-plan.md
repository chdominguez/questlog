# Questie: plan

Turn Questlog into **Questie**: an open-source gamified learning app (self-hostable) plus a hosted SaaS where AI builds courses, paid with credits. Target audience: technical self-learners.

## Decisions (final, from the owner)

| Decision | Choice |
|---|---|
| Name | Questie (the mascot is already called Questie) |
| First audience | Technical self-learners |
| How people pay | Subscription with monthly credits + top-up packs |
| What costs credits | AI course from a topic; course from your files, notes, URL or repo; AI grading of written answers; AI corrections and stronger answer; mock exams; narrated lessons |
| Entry price | EUR 11.99 / month |
| Free tier includes | Every library course; all games, katas, SRS, notes; self-hosting with your own API key; one free AI-built course |
| License | AGPL-3.0 app; MIT course format (schema + authoring SDK); CC-BY-4.0 library courses |
| Hosting and database | Same container on a VPS or Fly, SQLite (node:sqlite) + Litestream backups |
| Sign-in | Better Auth inside the app |
| Web payments | Stripe + Stripe Tax |
| iOS and Android | Capacitor wrapper around the web app |
| Buying credits in mobile apps | In-app purchase through RevenueCat |
| Website and authoring docs | Astro Starlight (landing + docs in one site) |
| AI course builder starts from | A topic and level; uploaded PDFs and notes; web research with citations |
| Library courses come from | We build them with AI and review them; community pull requests; users publish their AI-built courses |
| Launch order | Rename + website/docs -> SaaS beta -> mobile (all built in this effort) |

Follow-up answers:
- Narrated lessons: **ElevenLabs** TTS. Cache audio per lesson+voice so a lesson is paid once.
- Credits: plan EUR 11.99/month = 1,000 credits/month. Costs: topic course 100, course from files/notes/URL/repo 150, web-research course 200, grading 2, correction/stronger answer 3, mock exam 20, narrated lesson 10. Top-ups: 500 credits EUR 5.99, 1,500 credits EUR 14.99. Free users: one free AI-built course (topic). All numbers live in ONE config module so they can be tuned.
- User-published courses: **review queue**. Visible by link immediately; enter the public library after an owner/admin approves.
- Self-host: **one mode only**. Drop the proxy-header login (USER_HEADER / NAME_HEADER / LOGOUT_URL). Better Auth always. Self-hosters bring their own ANTHROPIC_API_KEY (and optionally ELEVENLABS_API_KEY); when STRIPE keys are not configured, billing is off and AI features are not metered.

## Starting point (verified)
- Repo: React + Vite SPA (`src/`), Node + Hono server with `node:sqlite` (`server/`), shared types (`shared/`), courses as files (`courses/`, schema `src/course/schema.ts`, `npm run validate`), MCP server (`mcp/`), Claude Code plugin (`plugins/questlog/skills`), PWA (`public/manifest.webmanifest`, `public/sw.js`), Dockerfile + docker-compose, migrations in `migrations/`.
- Auth today: `server/api.ts` reads the user id from `USER_HEADER` set by a reverse proxy.
- AI today: written-answer grading via `@anthropic-ai/sdk` (server Grader), mock exams (`src/screens/MockScreen`).
- Repo is public on GitHub under MIT (copyright holder: the owner, so relicensing is allowed).
- Commits must be GPG-signed.

## Competitive research (done)
Oboe, Gauth AI Course, NerdSip, Morso build courses from prompts with MCQ + streaks. NotebookLM / Learn Your Way make flashcards and quizzes from sources with no gamification. Gizmo has lives/leagues but only flashcards/MCQ. Questie's edge: 12 challenge types + arcade games, runnable katas, traces/flows, AI-graded written answers, schema-validated AI courses, FSRS, open format + MCP authoring.

## Scope (all of it ships in this effort)
1. Rename Questlog -> Questie everywhere (package, UI, manifest, plugin, MCP, docs, Docker). Keep existing users' data: migrate localStorage keys and DB without loss.
2. Licensing: LICENSE (AGPL-3.0) at root; MIT for the course format package/paths; CC-BY-4.0 for `courses/`. NOTICE/README section explaining the split.
3. Accounts: Better Auth (email+password, magic link optional, Google, Apple), sessions in SQLite, bearer/cookie for Capacitor apps. Migrate existing per-user data keyed by email.
4. Billing: Stripe Checkout + Customer Portal + Stripe Tax for the EUR 11.99 subscription and top-ups; webhook -> credits ledger. RevenueCat webhook for iOS/Android purchases -> same ledger.
5. Credits: ledger table, balance, monthly grant, spend with idempotency, refunds on AI failure, 402 when insufficient. Metered: course builds, grading, corrections, mock exams, narration.
6. AI course builder: from topic+level, from uploaded PDFs/notes (and URL/repo), from web research with citations (Anthropic web search tool). Pipeline: outline -> write -> `validateCourse` -> fix loop -> save as the user's private course. Background job with progress UI.
7. Narrated lessons via ElevenLabs, cached audio.
8. Library: owner-built courses, community PRs (CONTRIBUTING + CI validation), user publishing with review queue, admin approve/reject.
9. Website + docs: Astro Starlight in `site/`: landing page, pricing, docs for learners, course authoring (schema reference, challenge types, MCP, Claude Code plugin), self-hosting, contributing.
10. Ops: Litestream in the Docker image, fly.toml + VPS compose, backup/restore docs, env reference.
11. Mobile: Capacitor (iOS + Android projects), auth in-app, RevenueCat purchases, push/reminders, audio.

## Verification
`npm test`, `npm run typecheck`, `npm run validate` green; site builds; Capacitor sync works; E2E: sign up -> free AI course -> subscribe (Stripe test mode) -> credits granted -> build course from PDF -> grade answer -> publish to review queue -> admin approves -> appears in library.

## Coordinator decisions after research (wave 0)
- Credits: plan credits reset each billing month (no rollover); top-up credits never expire; spend plan credits first.
- Grading is split: "Grade" (score, key points hit/missed, feedback) = 2 credits; "Stronger answer + corrections" is a separate on-demand action after a grade = 3 credits.
- Show the credit cost on every AI button; confirm before spends of 100+ credits; refund automatically when an AI job fails.
- Web-research courses always carry citations (source links per theory card).
- AI-built courses are validated server-side in a sandbox (no in-process `new Function` / python3 on user-influenced content): run kata checks in a worker thread / child process with time + memory limits, or skip runtime kata checks and validate statically, then run katas client-side.
- User courses live in the DB (runtime registry), not in the build-time bundle.
- Deploy-specific identifiers (current SQLite filename, compose project, CI runner label) keep working: rename with a fallback/migration, never break the live deploy.
- Contributions: CLA (CLA Assistant) for app code so the owner keeps relicensing options; DCO sign-off for library courses (CC-BY-4.0).
