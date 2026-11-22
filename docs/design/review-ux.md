# Questie: UX review

Branch `questie` vs `main`, checked against `questie-ux.md`, `questie-plan.md`, `questie-prd.md` and `questie.md`. Reviewed 2026-11-22.

## How it was checked

- App: client build plus `server/e2e.ts` (fake Anthropic, Stripe, ElevenLabs, Resend, FCM) on port 5299. Site: `npm run site:build`, `astro preview` on port 5301.
- Playwright drove the full product flow four times (light/dark, 1280 px and 390 px): sign in, sign up, verify, welcome, free build, job, map, plans, credits, top-up sheet, Stripe checkout, billing done, builder (topic, files, web research), confirm spend, build from PDF, narration (locked and playing), grade, stronger answer, mock, share and publish, review queue (pending, reports, reject), library, profile, delete dialog, home, low-balance notice and the 402 sheet. Site: landing, pricing, `learn/credits`.
- Job progress and job failure were captured by faking `GET /api/jobs/:id`, because the fake builder finishes at once (`*--job-progress-faked.png`, `*--job-failed-faked.png`).
- Keyboard and a11y probes: tab order, dialog focus and Esc, builder tab arrows, target sizes, 320 px reflow (no horizontal scroll found), reduced motion (overlay and dialog animations are off), and token contrast.
- Screenshots: `docs/design/review-ux/<variant>--<screen>.png` (199 files, not committed).

Overall the flows, states and copy follow `questie-ux.md` closely. Cost buttons, confirm-at-100, the 402 sheet, refunds, Stripe return, share/publish, the review queue and delete account all work end to end in every variant. The issues below are the verified exceptions.

## Findings

### High

**H1. Mock exams cannot be reached for any public or AI-built course**
- Where: `src/screens/Map.tsx:41` (button shown only when `course.mock` is set); `server/builder.ts` never writes `mock`; no course in `courses/` has one.
- Problem: the 20-credit mock exam is sold on Plans (`Mock exam · 20`), on the site pricing page and in `learn/mock` ("Open a course that has a mock exam"), but no library course and no built course has one. The only way in is typing `#/c/<id>/mock`. PRD CRD-7 and CRD-9 meter a feature users can't find.
- Fix: show the mock button on the Map for any course with written challenges. `pickMockQuestions` already falls back to written challenges from across the course, and `MockScreen` defaults the title to `Exam` and the time to 30:00. Or have the builder emit `mock` for built courses. Keep it hidden when `features.ai` is false (UX 8).

### Medium

**M1. Build failure never says why**
- Where: `src/builder/JobScreen.tsx:128-137`; `src/builder/BuildScreen.tsx:40`.
- Problem: `job.error.message` is never rendered. A files build with an unreachable URL (`source_unreachable`, "Couldn't fetch the URL"), a research build with too few sources, or a declined request all show only `Build failed` + `100 credits refunded` (`mobile-light--job-failed-faked.png`). The user presses Try again with the same input and fails again. The UX 5.1 messages (`Couldn't fetch this URL`, `Repo not public`) are never shown, because those checks run inside the job, not as a pre-check. Start errors other than `topic_too_broad`, `job_limit` and 402 all collapse to `Couldn't start build`.
- Fix: map `job.error.code` to one line under the title (`source_unreachable` → `Couldn't fetch this URL`, `too_few_sources` → `Not enough sources`, `build_rejected` → `Topic not supported`, otherwise no line). Do the same for start errors in `useStartBuild`.

**M2. Plan / top-up breakdown goes stale after every spend**
- Where: `src/auth/session.ts:39-43` (`setBalance` patches only `total`); read by `src/billing/ProfileBilling.tsx:54` and `src/billing/CreditsScreen.tsx:51`.
- Problem: after a 150 build, a grade, a stronger answer and narration, Profile shows `835 · 1,000 plan · 0 top-up`. The parts no longer add up to the total (`desktop-light--profile.png`; `/api/credits` returned `plan: 835`). The reset rule only makes sense if this split is right (CRD-2).
- Fix: Credits and Profile fetch `/api/credits` on mount (it already exists) and render from that. Or call `loadMe()` after a spend instead of patching `total` only.

**M3. The top-up "bottom sheet" is a centered dialog on phones**
- Where: `src/billing/billing.css:10` loses to `.overlay { place-items: center; padding: … }` in `src/engine/engine.css:152`. Same specificity, and engine.css comes later.
- Problem: at 390 px the sheet sits mid-screen with 16 px margins (measured box y=283, h=277 in an 844 px viewport; computed `place-items: center`, `padding: 16px`). See `mobile-light--topup-sheet-viewport.png`. UX 4.2 and 12.1 specify a bottom sheet with safe-area padding.
- Fix: raise specificity: `.overlay.overlay-sheet { place-items: end stretch; padding: 0; }`.

**M4. Review-queue tabs and Library filters show no selected state**
- Where: `src/library/QueueScreen.tsx:78-79`, `src/screens/Library.tsx:47`. Both use `.btn ghost` for every option, and there is no `[aria-selected]` / `[aria-pressed]` rule in `src/library/library.css`.
- Problem: `All`, `Questie` and `Community` compute the same background and colour whether pressed or not. `Pending` and `Reports` look the same too (`desktop-light--review-queue.png`, `--library.png`). Sighted users can't tell which filter or tab is on. The queue tabs also lack `aria-controls`, a `tabpanel` and arrow-key handling, which the builder tabs have.
- Fix: use the builder pattern (`className={on ? "btn" : "btn ghost"}`), or add `.lib-tabs [aria-pressed="true"], .lib-tabs [aria-selected="true"] { background: var(--accent); color: var(--accent-ink); }`. Give the queue tabs the same roving tabindex and arrow keys as `BuildScreen.tsx:194-201`, or make them `aria-pressed` toggle buttons.

**M5. Reset password is a dead end**
- Where: `src/auth/ForgotScreen.tsx:26-34`.
- Problem: the screen has no link (0 anchors). After `Link sent`, or if the user remembers the password, the only way out is the browser back button. The iOS app has no back button.
- Fix: add the same footer as Sign up: `Have an account?` + `Sign in` (`href.signin()`).

**M6. New text colours fail AA contrast in light mode**
- Where and measured ratios (normal-size text needs 4.5:1):
  - `src/answers/answers.css:50` `.gv-fix` `--ok` on the `--sticky` card: 3.88:1.
  - `src/answers/answers.css:49` `.gv-quote` `--bad` on `--sticky`: 4.10:1 (`desktop-light--stronger-answer.png`).
  - `src/billing/billing.css:31` `.delta.up` `--ok` on `--surface`: 4.37:1 (credit history `+1,000`).
  - `src/billing/billing.css:3` `.credit-chip.low` `--gold` on `--bg`: 4.06:1 (the Hud balance below 100).
- Problem: UX 13.1 says new screens use only tokens that pass AA. These pairs don't.
- Fix: in the light scheme use `--fg` for the correction text and mark the quote and fix with the arrow and `<del>`/`<ins>` (or an underline). For deltas and the low chip, add darker light-mode tokens (e.g. `--ok-ink: #237032`, `--gold-ink: #8a5d00`, both above 4.5:1 on paper and white). Dark mode passes for all of these.

### Low

**L1. Show / Hide password toggle is a 291 × 21.5 px target, floating mid-row**
- Where: `src/auth/auth.css:10` (`.auth-show { min-height: 0 }`); `src/auth/parts.tsx:33,47`.
- Problem: the button stretches across the label row, so `Show` sits in the middle instead of at the right edge (UX 2.1). It is 21.5 px tall, under the 44 px rule in UX 13.1 and the 24 px WCAG 2.5.8 minimum.
- Fix: `.auth-show { min-height: 44px; width: auto; margin-left: auto; }` and `.auth-pass { align-items: end; }`.

**L2. Empty sign-in shows the email error under Password**
- Where: `src/auth/SignInScreen.tsx:161-169, 199`.
- Problem: submitting empty fields goes to the server. `INVALID_EMAIL` comes back as `Enter a valid email` in the form-level alert under Password, and focus moves to Password (`desktop-light--auth-signin-empty.png`).
- Fix: run `validEmail` before the request, set `emailError` (it renders under Email with `aria-describedby`) and focus Email, as Sign up already does.

**L3. Sign up shows the password rule twice**
- Where: `src/auth/parts.tsx:35-36`.
- Problem: on error, both the hint `8+ characters` and `Password needs 8+ characters` show (`desktop-light--auth-signup-errors.png`).
- Fix: render the hint only when there is no error.

**L4. Owner course status is cached for the whole session**
- Where: `src/library/api.ts:23` (`loading ??=`, loaded once). Home's list uses the separate cache in `src/builder/api.ts`.
- Problem: after an admin approves or rejects, the owner's Home pill and Share dialog keep showing `In review` until a full reload (`desktop-light--home.png`, taken after approval). The rejection reason (UX 5.7) is never seen in a long-lived tab or the native app.
- Fix: refetch metas when Home mounts and when the Share dialog opens (reset `loading`).

**L5. The Hud takes three rows at 390 px**
- Where: `src/engine/engine.css:11` (`.hud-row` wraps); `src/engine/Hud.tsx:62`.
- Problem: rank and XP wrap onto a third row, and the volume slider stays on mobile web. The Hud is about 140 px tall, about 190 px with the course tabs (`mobile-light--map-owned.png`). UX 12.1 asks for two rows: brand + chip + streak, then nav.
- Fix: at ≤ 520 px hide `.hud-rank-body` (keep the badge) and the volume slider (keep mute), so row 1 holds brand, chip, streak, mute and rank badge.

**L6. Low-balance notice is a floating toast over content**
- Where: `src/billing/billing.css:18`; `src/billing/LowBalance.tsx:26`.
- Problem: it is fixed at the bottom center and covers form controls and the build button area (`desktop-light--builder-low-balance.png`). UX 4.3 places it as a card under the Hud, and UX 0.2 says toasts don't exist in the app.
- Fix: render it in flow under the Hud (static `.card`, full width) instead of `position: fixed`.

**L7. Site CTAs skip sign-up**
- Where: `site/src/components/Landing.astro:115`, `site/src/components/Pricing.astro:22,33`.
- Problem: `Start free` links to `APP_URL`, so a new visitor lands on Sign in (UX 1.1: Landing → `#/signup`). Pricing `Subscribe` goes to `#/plans` → `#/signin?next=#/plans`, and `next` is lost once the visitor moves to Create account.
- Fix: link `Start free` to `${APP_URL}/#/signup`. Carry `next` through signup and verify (`callbackURL`) so `Subscribe` ends on Plans.

**L8. Mock intro says "1 questions"**
- Where: `src/screens/Mock.tsx:82` (the line predates the branch; the screen was reworked in it).
- Fix: pluralize as `JobScreen` does: `n(questions.length, "question", "questions")`.

**L9. Report flag sits on its own row inside theory cards**
- Where: `src/engine/Theory.tsx:77` (between `h2` and the blocks); `src/library/library.css:12`.
- Problem: the flag leaves an empty band between the title and the body on every card (`desktop-light--narration-locked.png`), and on written challenges (`--graded.png`).
- Fix: put the title and `ReportButton` in one flex row (`justify-content: space-between`).

**L10. The Welcome "done" flag lives in localStorage**
- Where: `src/screens/Welcome.tsx:16-18`.
- Problem: UX 3 says the flag is stored server-side. A user who pressed Skip without making progress sees Welcome again on every new device or browser.
- Fix: store it on the profile (or with the synced progress) and read it from `/me`.

**L11. Copy link fails silently**
- Where: `src/library/ShareButton.tsx:45-49`.
- Problem: if the clipboard write is refused (permissions, insecure context, some webviews), the course still becomes `link` but nothing is shown and no URL is visible.
- Fix: on failure show the URL in a read-only selectable field (or call `navigator.share` on native), with a short `Copy failed` status.

**L12. Two quick approvals lose the first Undo**
- Where: `src/library/QueueScreen.tsx:33, 45-54` (one `held` slot).
- Problem: approving row A and then row B within 5 s replaces A's `Undo`. A still goes through with no way back.
- Fix: keep held approvals in a list and render one `Approved · <title>` + `Undo` per held row.

## UI copy (ui-copy skill)

Every new string in the diff was read: JSX text, `aria-label`, `placeholder`, `title`, dialogs, status and error lines. They match the UX copy index (UX 14): short labels, no descriptions under titles, no filler, no emoji, sentence case. No string breaks the rule. Copy-related gaps are listed above: missing failure reasons (M1), the duplicate password hint (L3) and the plural (L8).

## Not issues (checked)

- `/c/:id` share links: `src/main.tsx:11` rewrites them to the hash route.
- Dialog focus: the top-up sheet starts on its first option and traps Tab. Esc returns focus to `Top up`. Delete account starts on `Cancel`. Builder tabs follow the ARIA tabs pattern (arrows, Home/End).
- Reduced motion turns off overlay and dialog animations. The build spinner has its own rule.
- No horizontal scroll at 320 px on Welcome, Build, Plans, Credits, Library, Profile, Review queue or Home.
