# Questie: UX

User flows, wireframes, states and exact copy for every new or changed screen. Decisions come from `questie-plan.md` and `questie-prd.md` (requirement IDs in brackets). Written 2026-11-22.

## 0. Ground rules

### 0.1 Design system

Notebook design stays as is (`src/ui/global.css`): paper `--bg` with ruled lines, blue pen `--accent`, Caveat display headings, Atkinson body, JetBrains Mono for numbers in code, light and dark from the OS. New screens use tokens only.

Reuse, do not re-create:

| Need | Existing piece |
|---|---|
| Page frame | `<Hud />` + `.scr` + `.scr-head` (back link `.back`, `h1`) |
| Primary / secondary / tertiary action | `.btn`, `.btn.ghost`, `.btn.quiet` (44 px min height) |
| Panel | `.card` |
| Text input, label | `.scr-input` inside `label.profile-field` |
| Inline status / error | `p.wa-notice role="status"`, `role="alert"` for failures |
| Empty state | `p.scr-empty` |
| Status chip | `.pill` (`.pill-ok`, `.pill-mid`, `.pill-bad`), `.tag` |
| Toggle | `label.switch` |
| Progress bar | `.progress` / `.bar` with `role="progressbar"` |
| Modal | `.overlay` + `role="dialog"` with the focus pattern of `LevelUp` (`src/engine/Celebrate.tsx`) |
| Score | `ScoreRing`, `ScorePill`, `GradeView` |
| Course list item | `.course-card` from Home |
| Mascot | `Questie` (moods idle, happy, sad, think, cheer), `Guide` |
| Icons | `@phosphor-icons/react` (already a dependency) |

New shared pieces, kept small:

| Piece | What it is |
|---|---|
| `CostLabel` | Renders `Build course · 100` inside any `.btn`. Hidden cost when billing is off. Shows `Free` when the free course applies |
| `Confirm` | `.overlay` dialog: title (question), optional one-line body, Cancel + action. Built from the `LevelUp` focus code |
| `TopUpSheet` | Dialog on desktop, bottom sheet at <= 520 px. Opens on 402 and from every Top up button |
| `CreditChip` | Hud item: coins icon + balance, links to Credits |

### 0.2 Copy rules

- Titles: noun phrase, 1-3 words. Buttons: verb + object, 1-3 words. No description under titles.
- Counts and state as data: `860 plan · 100 top-up`, not prose.
- Errors: what failed, plus the fix only when it is not obvious. One line.
- Toasts do not exist in the app; transient results use the inline `.wa-notice role="status"` already used by Profile and WrittenAnswer.
- Never: "unlimited" [CRD-13], "Tip:", "Note:", "easily", "anytime", emoji, exclamation marks.
- Sentence case, no period on titles, labels or buttons.
- Numbers: credits with a thin grouping comma (`1,000`), prices `€11.99`, dates `22 Dec`.
- The cost separator is a middle dot: `Grade · 2`. Screen readers get `Grade, 2 credits` (see 13.2).

### 0.3 Brand

- Hud brand text `Questlog` -> `Questie` (`src/engine/Hud.tsx:48`), `<title>` `Questie`, manifest name `Questie`, default push title `Questie` [REN-1].
- The mascot appears on sign-in, onboarding, builder progress and builder result only. It never talks in sentences on these screens.

### 0.4 Capability flags

The client reads these from `GET /api/me` and hides what is off. Every wireframe below assumes all on unless it says otherwise.

| Flag | Off when | UI effect when off |
|---|---|---|
| `billing` | No Stripe keys (self-host) [BIL-7] | No CreditChip, no costs on buttons, no Plans, no Plan/Credits sections, no confirm dialogs, no free-course badge, no 402 path |
| `ai` | No `ANTHROPIC_API_KEY` | No Build nav item, no Grade button (self-rating only, as today), no mock exam button |
| `narration` | No `ELEVENLABS_API_KEY` [NAR-3] | No Listen button |
| `admin` | Email not in `ADMIN_EMAILS` | No Review queue link |
| `native` | Running in Capacitor | IAP sheet instead of Stripe, store wording (section 12) |

`/me` also returns `credits: { total, plan, topup, resetsAt }`, `plan: { status, source, renewsAt, endsAt }`, `freeCourse: boolean` (unused free build left), `lowWarned: boolean`.

### 0.5 Routes

Hash routes stay (`src/ui/route.ts`). New ones:

| Route | Screen | Auth |
|---|---|---|
| `#/signin` | Sign in | Public |
| `#/signup` | Create account | Public |
| `#/verify` | Check your email | Public |
| `#/forgot` | Reset password request | Public |
| `#/reset/:token` | New password | Public |
| `#/welcome` | Onboarding | Signed in |
| `#/plans` | Plans and pricing | Signed in |
| `#/billing/done` | Stripe success return (`?session_id=` in the query, before the hash) | Signed in |
| `#/profile/credits` | Credits balance + history | Signed in |
| `#/build` | Course builder form | Signed in |
| `#/build/:job` | Build progress and result | Signed in, job owner |
| `#/library` | Library | Signed in |
| `#/admin/review` | Review queue | Admin |

Every signed-in route redirects to `#/signin?next=<hash>` when there is no session, and back to `next` after sign-in. Shared course links (`#/c/:course`) work the same way.

Hud nav becomes: `Courses` · `Library` · `Build` · `Profile`, then CreditChip, rank, streak, sound.

## 1. Flows

### 1.1 New user to first course (web)

```
Landing (site) --"Start"--> #/signup --> #/verify --(email link)--> #/welcome
  #/welcome: topic + level --"Build course · Free"--> #/build/:job (progress) --> result --"Start"--> #/c/:id (Map)
  #/welcome: pick a library course --> #/c/:id
  #/welcome: "Skip" --> #/ (Home, empty state)
```

Google / Apple: `#/signin` -> provider -> back to `#/welcome` (new account) or `next` / `#/` (existing). No verify step: provider emails count as verified.

### 1.2 Existing Questlog user

```
Open app --> no session --> #/signin --> sign in with the same email (verified)
  --> server attaches old rows [ACC-7] --> no progress wipe [ACC-8] --> #/ (Home with their courses)
```

No onboarding when the account already has progress. No migration screen: it just works.

### 1.3 Run out of credits

```
Any AI button --> server 402 (or client sees balance < cost) --> TopUpSheet
  Free user:   [Subscribe · €11.99/mo]  [500 · €5.99]  [1,500 · €14.99]
  Subscriber:  [500 · €5.99]  [1,500 · €14.99]
  --> Stripe Checkout --> #/billing/done --> "Continue" --> back to the screen that hit 402, form kept
```

The pending action is never auto-run after payment; the user presses the button again.

### 1.4 Big spend (100+)

```
"Build course · 150" --> Confirm "Spend 150 credits?" (Balance after: 810) --> "Build" --> job starts
```

Below 100 (grade 2, stronger answer 3, narration 10, mock 20): no confirm [CRD-5].

### 1.5 Build from files

```
#/build --> Files tab --> Add files / paste URL --> uploads start at once (per-file progress)
  --> level --> "Build course · 150" --> Confirm --> #/build/:job --> result
Build fails --> "Build failed" + "150 credits refunded" --> Try again (form restored)
```

### 1.6 Publish

```
Map of own course --> "Share" --> Share dialog
  "Copy link"          status private -> link
  "Submit to library"  status link -> pending --> admin approves --> public (in Library)
                                             --> admin rejects --> rejected (reason shown to owner)
  "Make private"       any -> private
```

### 1.7 Admin review

```
Profile --> "Review queue · 3" --> #/admin/review --> row --> "Open" (course map in new tab)
  --> "Approve" --> row leaves queue
  --> "Reject" --> reason required --> row leaves queue
```

### 1.8 Mobile purchase

```
AI button --> 402 --> IAP sheet (store prices) --> native store sheet --> purchase
  --> "Adding credits…" (poll balance until RevenueCat webhook lands) --> "Credits added" --> sheet closes
```

## 2. Sign in and sign up

Full-page, no Hud. Centered column, max 400 px, `.card`. Questie (idle) above the title.

### 2.1 Sign in `#/signin`

```
+------------------------------------------+
|                 [Questie]                |
|                                          |
|  Sign in                                 |
|                                          |
|  [ G  Continue with Google            ]  |  .btn.ghost
|  [   Continue with Apple             ]  |  .btn.ghost (black Apple mark)
|                                          |
|  ------------------ or ----------------  |
|                                          |
|  Email                                   |
|  [______________________________]        |
|  Password                     [Show]     |
|  [______________________________]        |
|                                          |
|  [ Sign in                            ]  |  .btn
|                                          |
|  Forgot password?        Create account  |  links
|                                          |
|             Terms · Privacy              |  muted links
+------------------------------------------+
```

| Element | Copy | Notes |
|---|---|---|
| Title | `Sign in` | |
| Google | `Continue with Google` | |
| Apple | `Continue with Apple` | Same size and weight as Google (Apple guideline) |
| Divider | `or` | `aria-hidden` |
| Fields | `Email`, `Password` | `autocomplete="email"`, `current-password`; `type="email"`, `enterkeyhint="go"` |
| Toggle | `Show` / `Hide` | `aria-pressed`, `aria-controls` the password input |
| Submit | `Sign in` -> `Signing in…` while busy | Disabled while busy |
| Links | `Forgot password?`, `Create account`, `Terms`, `Privacy` | Terms/Privacy go to the site |
| Magic link (Should, ACC-3) | `Email me a link` | `.btn.quiet` under Submit; sends a link to the typed email, then shows `Link sent` |

States:

| State | UI |
|---|---|
| Wrong credentials | `Wrong email or password` (`role="alert"` above Submit), focus stays in Password |
| Unverified email | `Email not verified` + `.btn.quiet` `Resend email` |
| Rate limited | `Too many attempts. Wait a minute.` |
| Network | `Couldn't connect` |
| Provider canceled | Back on `#/signin`, no message |
| Provider failed | `Google sign-in failed` / `Apple sign-in failed` |
| Account exists with another method | `Use Google to sign in` / `Use Apple to sign in` / `Use your password to sign in` |
| Success | Go to `next`, else `#/welcome` for a new account, else `#/` |

### 2.2 Create account `#/signup`

```
+------------------------------------------+
|                 [Questie]                |
|  Create account                          |
|  [ G  Continue with Google            ]  |
|  [   Continue with Apple             ]  |
|  ------------------ or ----------------  |
|  Name                                    |
|  [______________________________]        |
|  Email                                   |
|  [______________________________]        |
|  Password                     [Show]     |
|  [______________________________]        |
|  8+ characters                           |  muted, aria-describedby
|  [ Create account                     ]  |
|  Have an account? Sign in                |
|             Terms · Privacy              |
+------------------------------------------+
```

| Element | Copy |
|---|---|
| Title | `Create account` |
| Fields | `Name` (`autocomplete="name"`), `Email`, `Password` (`new-password`) |
| Hint | `8+ characters` (passes the test: the rule is not visible otherwise) |
| Submit | `Create account` -> `Creating…` |
| Link | `Have an account?` + `Sign in` |

Errors: `Email already registered` + `.btn.quiet` `Sign in`; `Password needs 8+ characters`; `Enter a valid email`; `Name is required`. Field errors render under the field with `aria-describedby` and `aria-invalid="true"`; focus moves to the first invalid field.

### 2.3 Check your email `#/verify`

```
+------------------------------------------+
|                 [Questie]                |
|  Check your email                        |
|  ada@example.com                         |
|  [ Resend email ]   [ Change email ]     |  .btn.ghost, .btn.quiet
+------------------------------------------+
```

- `Resend email` -> `Email sent` (status). Disabled for 60 s after each send, label `Resend in 0:42`.
- `Change email` -> back to `#/signup` with fields filled.
- The verification link signs the user in and opens `#/welcome`.
- Expired link: `#/signin` with `Link expired` + `Resend email`.

### 2.4 Forgot and reset

`#/forgot`: title `Reset password`, field `Email`, button `Send link`. After send: `Link sent` (same message whether or not the email exists).

`#/reset/:token`: title `New password`, field `Password` + hint `8+ characters`, button `Save password`. Success: signed in, `#/`. Expired token: `Link expired` + `Send new link`.

## 3. Onboarding `#/welcome`

Shown once, only to accounts with no progress and no courses. One screen. `Skip` always visible.

```
+--------------------------------------------------------+
| Questie                                        [Skip]  |  brand, .btn.quiet
|                                                        |
|  [Questie: cheer]                                      |
|  What do you want to learn?                            |  h1
|                                                        |
|  +--------------------------------------------------+  |
|  | Topic                                            |  |
|  | [Rust ownership and borrowing__________________] |  |
|  | Level  ( ) Beginner  (•) Intermediate  ( ) Advanced |
|  | [ Build course · Free ]                          |  |
|  +--------------------------------------------------+  |
|                                                        |
|  Library                                               |  h2
|  +-------------+ +-------------+ +-------------+       |
|  | HTTP basics | | Git inside  | | SQL joins   |       |  .course-card x3
|  | 8 levels    | | 6 levels    | | 7 levels    |       |
|  +-------------+ +-------------+ +-------------+       |
|  Browse library                                        |  link
+--------------------------------------------------------+
```

| Element | Copy |
|---|---|
| Title | `What do you want to learn?` |
| Topic placeholder | `Rust ownership and borrowing` |
| Level radios | `Beginner`, `Intermediate`, `Advanced` (default Intermediate) |
| Button | `Build course · Free` (free course unused); `Build course · 100` (used); `Build course` (billing off) |
| Section | `Library` |
| Link | `Browse library` |
| Skip | `Skip` |

- Picking a library card opens its Map.
- Topic validation and vague-topic handling are the same as the builder (5.3).
- `ai` off: the topic card is not rendered; only Library shows.
- After any choice or Skip, the flag is stored server-side so the screen never returns.

## 4. Plans and credits

### 4.1 Plans `#/plans`

Reached from TopUpSheet, Profile, CreditChip, `Subscribe` anywhere. Web only (native: section 12.3).

```
+------------------------------------------------------------+
| [<-] Plans                                                 |
|                                                            |
| +------------------------+  +----------------------------+ |
| | Free                   |  | Questie                    | |
| | €0                     |  | €11.99 / month             | |
| |                        |  | 1,000 credits / month      | |
| | ✓ Every library course |  | ✓ Everything in Free       | |
| | ✓ Games, katas, review,|  | ✓ AI courses from topics,  | |
| |   notes                |  |   files and web research   | |
| | ✓ 1 AI course          |  | ✓ AI grading               | |
| |                        |  | ✓ Narrated lessons         | |
| | [ Current plan ]       |  | [ Subscribe ]              | |
| +------------------------+  +----------------------------+ |
| VAT included                                               |
|                                                            |
| Top-ups                                                    |  h2
| +------------------------+  +----------------------------+ |
| | 500 credits   €5.99    |  | 1,500 credits   €14.99     | |
| | [ Buy ]                |  | [ Buy ]                    | |
| +------------------------+  +----------------------------+ |
| Top-up credits never expire                                |
|                                                            |
| Credit costs                                               |  h2
| .tbl                                                       |
| | Course from a topic                    | 100 |           |
| | Course from files, notes, URL or repo  | 150 |           |
| | Course from web research               | 200 |           |
| | Grade an answer                        |   2 |           |
| | Stronger answer                        |   3 |           |
| | Mock exam                              |  20 |           |
| | Narrated lesson                        |  10 |           |
|                                                            |
| Plan credits reset each month. Spent before top-ups.       |
+------------------------------------------------------------+
```

Copy:

| Element | Copy |
|---|---|
| Title | `Plans` |
| Plan names | `Free`, `Questie` |
| Prices | `€0`, `€11.99 / month` |
| Plan credits | `1,000 credits / month` |
| Free list | `Every library course`, `Games, katas, review, notes`, `1 AI course` |
| Paid list | `Everything in Free`, `AI courses from topics, files and web research`, `AI grading`, `Narrated lessons` |
| Buttons | `Subscribe`, `Current plan` (disabled), `Manage` (subscriber, opens Stripe portal) |
| Tax line | `VAT included` |
| Packs | `500 credits` / `€5.99`, `1,500 credits` / `€14.99`, button `Buy` |
| Pack line | `Top-up credits never expire` |
| Table title | `Credit costs` |
| Table rows | as drawn; values come from the config module [CRD-6] |
| Rule line | `Plan credits reset each month. Spent before top-ups.` |

The two rule lines pass the copy test: without them a user cannot know credits expire or which credits go first [CRD-2], the top billing complaint in research.

States:

| State | UI |
|---|---|
| Free | Free card shows `Current plan`; Questie card `Subscribe` |
| Subscribed | Questie card `Current plan` + `.btn.ghost` `Manage`; Free card no button |
| Canceled, active until period end | Questie card `.pill-mid` `Ends 22 Dec` + `Manage` |
| Past due | Questie card `.pill-bad` `Payment failed` + `Update payment` (portal) |
| Store subscriber on web | Questie card `Current plan` + `.tag` `App Store` / `Google Play`; no Manage |
| Redirecting | Pressed button label `Opening checkout…`, all buy buttons disabled |
| Checkout start failed | `Couldn't open checkout` (alert) |
| Returned from cancel | `Checkout canceled` (status) at the top |
| Price change announced (CRD-12) | `.card` above plans: `New credit costs from 1 Jan` + `.btn.quiet` `View` (scrolls to the table, new values shown beside old) |

Keyboard: cards are not clickable; only buttons are. Tab order: Subscribe, Buy, Buy.

### 4.2 Top-up sheet (web)

Opens on any 402, from `Top up` buttons, and from CreditChip when balance is 0. Dialog on desktop, bottom sheet at <= 520 px.

```
Desktop                                   Phone (<= 520 px)
+------------------------------------+    |                              |
| Not enough credits            [x]  |    +------------------------------+
| Needs 150 · You have 40            |    | Not enough credits      [x]  |
|                                    |    | Needs 150 · You have 40      |
| [ Subscribe · €11.99/mo        ]   |    | [ Subscribe · €11.99/mo   ]  |
|   1,000 credits / month            |    |   1,000 credits / month      |
| [ 500 credits · €5.99          ]   |    | [ 500 credits · €5.99     ]  |
| [ 1,500 credits · €14.99       ]   |    | [ 1,500 credits · €14.99  ]  |
|                                    |    | Plans                        |
| Plans                              |    |  (safe-area bottom padding)  |
+------------------------------------+    +------------------------------+
```

| Variant | Title | Line under title |
|---|---|---|
| Opened by 402 | `Not enough credits` | `Needs 150 · You have 40` |
| Opened by Top up | `Top up` | `Balance 40` |

- `Subscribe · €11.99/mo` shows only for users without a plan, as the first (`.btn`) option; packs are `.btn.ghost`. For subscribers the first pack is `.btn`.
- `Plans` is a `.btn.quiet` link to `#/plans`.
- Pressing an option: label becomes `Opening checkout…`, others disabled, then redirect.
- Before redirect the client saves `{ returnTo: location.hash, draft }` in `sessionStorage` (`ql.checkout`), so the builder form and the answer text survive.
- Close: `[x]` (`aria-label="Close"`), Esc, or click on the backdrop. Focus returns to the AI button that opened it.
- Self-host (billing off): never opens.

### 4.3 Low-balance warning

Once per billing period [CRD-11], after a spend leaves fewer than 100 credits (config `LOW_BALANCE`):

```
| 40 credits left                         [Top up]  [x] |   .card, under the Hud, role="status"
```

- Copy: `40 credits left`, `Top up`, close `aria-label="Dismiss"`.
- Dismiss or Top up marks it seen (`lowWarned`), for this period.
- CreditChip switches to `--gold` while below the threshold.

### 4.4 Credit chip (Hud)

```
Questie  Courses  Library  Build  Profile        (◎ 960)  [rank]  (flame 4)  (speaker)
```

- Phosphor `Coins` icon + balance in tabular numbers. Link to `#/profile/credits`.
- Accessible name `960 credits`.
- Balance updates after every spend, refund or purchase (from the API response, no extra fetch). The change is not announced; the screen that spent already says what happened.
- Hidden when billing is off.

### 4.5 Credits `#/profile/credits`

```
+------------------------------------------------------------+
| [<-] Credits                                               |
|                                                            |
| +--------------------------------------------------------+ |
| |  960                                       [ Top up ]  | |  big Caveat number
| |  860 plan · 100 top-up                                 | |
| |  Plan credits reset 22 Dec                             | |
| +--------------------------------------------------------+ |
|                                                            |
| November                                                   |  h2 per month
| 22 Nov  Course: Rust ownership                      −150   |
| 22 Nov  Refund: build failed                        +150   |  .pill-ok on the delta
| 21 Nov  Grade × 6                                    −12   |
| 21 Nov  Stronger answer × 2                           −6   |
| 20 Nov  Mock exam: HTTP basics                       −20   |
| 19 Nov  Narration: Status codes                      −10   |
| 19 Nov  Top-up                                      +500   |
| 01 Nov  Monthly credits                           +1,000   |
| 01 Nov  Plan reset                                  −140   |
|                                                            |
| [ Show more ]                                              |
+------------------------------------------------------------+
```

Row labels (one per ledger reason):

| Ledger reason | Label | Links to |
|---|---|---|
| Monthly grant | `Monthly credits` | |
| Plan credits expired at reset | `Plan reset` | |
| Pack | `Top-up` | |
| Store purchase reversed | `Purchase reversed` | |
| Course build | `Course: <title>` (or `Course build` before the title exists) | Course map, or the job |
| Refund | `Refund: build failed`, `Refund: grading failed`, `Refund: audio failed`, `Refund: mock exam failed` | Same target as the spend |
| Grade | `Grade` (same day grouped: `Grade × 6`) | |
| Stronger answer | `Stronger answer` (grouped per day) | |
| Mock exam | `Mock exam: <course>` | Course map |
| Narration | `Narration: <level>` | Level |

| State | UI |
|---|---|
| Loading | Balance card with `…` in place of numbers; three skeleton rows using `--raise` |
| Empty (no rows) | `No activity` |
| No plan | Second line `0 plan · 100 top-up` hides; reset line hides |
| Error | `Couldn't load credits` + `.btn.ghost` `Retry` |
| More pages | `Show more` (`Loading…` while busy) |

The list is a `<table>` (`.tbl`) with a visually hidden header row: `Date`, `Activity`, `Credits`. Deltas carry a sign character and `--ok` / `--fg` colour; colour is never the only signal.

### 4.6 Stripe return `#/billing/done`

Stripe `success_url`: `<APP_URL>/?session_id={CHECKOUT_SESSION_ID}#/billing/done`. `cancel_url`: `<APP_URL>/#/plans?canceled` or the saved `returnTo` with the same flag. Portal `return_url`: `<APP_URL>/#/profile`.

The page calls the shared `fulfill` through `GET /api/billing/session/:id` [BIL-4], then polls up to 20 s.

```
Confirming                 Subscribed                  Credits added
+----------------------+   +----------------------+    +----------------------+
| [Questie: think]     |   | [Questie: cheer]     |    | [Questie: happy]     |
| Confirming payment…  |   | Subscribed           |    | Credits added        |
|                      |   | +1,000 credits       |    | +500 credits         |
|                      |   | Balance 1,040        |    | Balance 540          |
|                      |   | [ Continue ]         |    | [ Continue ]         |
+----------------------+   +----------------------+    +----------------------+
```

| State | Title | Body | Actions |
|---|---|---|---|
| Confirming | `Confirming payment…` | | none; `aria-busy="true"` |
| Subscription paid | `Subscribed` | `+1,000 credits` · `Balance 1,040` | `Continue` |
| Pack paid | `Credits added` | `+500 credits` · `Balance 540` | `Continue` |
| Async payment (SEPA etc.) | `Payment processing` | `Credits added when payment clears` | `Continue` |
| Not paid / expired | `Payment not completed` | | `Try again` (opens TopUpSheet), `.btn.ghost` `Continue` |
| Poll timed out | `Still confirming` | | `Refresh`, `.btn.ghost` `Continue` |
| Unknown session | `Payment not found` | | `Continue` |

- `Continue` goes to `ql.checkout.returnTo`, else `#/`; the draft is restored there. Focus moves to the title on each state change (`tabIndex=-1`), and the title is in a polite live region.
- The query string is removed with `history.replaceState` after load, so a refresh does not refetch.
- Cancel return: the origin screen shows `Checkout canceled` (status) once.

## 5. AI course builder

### 5.1 Builder `#/build`

Tabs pick the source mode. One form, one button. Each mode keeps its own field values while switching.

```
+------------------------------------------------------------+
| Questie  Courses  Library  [Build]  Profile    (◎ 960) ... |
+------------------------------------------------------------+
| New course                                                 |
|                                                            |
| [ Topic ]  [ Files ]  [ Web research ]                     |  role="tablist"
|                                                            |
| +--------------------------------------------------------+ |
| | Topic                                                  | |
| | [Rust ownership and borrowing_______________________]  | |
| |                                                        | |
| | Level                                                  | |
| | ( ) Beginner   (•) Intermediate   ( ) Advanced         | |
| |                                                        | |
| |                               [ Build course · 100 ]   | |
| +--------------------------------------------------------+ |
+------------------------------------------------------------+
```

Files tab:

```
| +--------------------------------------------------------+ |
| | Files                                                  | |
| | +----------------------------------------------------+ | |
| | |            [ Add files ]   or drop here            | | |  dashed --line, .btn.ghost
| | +----------------------------------------------------+ | |
| | intro.pdf          2.1 MB   [=========---]  [x]        | |  uploading
| | notes.md           14 KB    ✓                [x]       | |  done
| | scan.pdf           8.0 MB   No text found    [x]       | |  .pill-bad
| |                                                        | |
| | URL or repo                                            | |
| | [https://github.com/tokio-rs/tokio_______________]     | |
| |                                                        | |
| | Level   ( ) Beginner (•) Intermediate ( ) Advanced     | |
| |                               [ Build course · 150 ]   | |
| +--------------------------------------------------------+ |
```

Web research tab: same as Topic with button `Build course · 200`.

Copy:

| Element | Copy |
|---|---|
| Title | `New course` |
| Tabs | `Topic`, `Files`, `Web research` |
| Topic label / placeholder | `Topic` / `Rust ownership and borrowing` |
| Level | `Level`: `Beginner`, `Intermediate`, `Advanced` |
| Files label | `Files` |
| Drop zone | `.btn.ghost` `Add files` + `or drop here` |
| URL label / placeholder | `URL or repo` / `https://` |
| File row | name, size, progress or `✓`, remove `aria-label="Remove intro.pdf"` |
| Buttons | `Build course · 100` / `· 150` / `· 200`; topic mode with free course left: `Build course · Free` |

Validation and states:

| Case | Message (under the field, `role="alert"`) | When |
|---|---|---|
| Empty topic | `Enter a topic` | On submit |
| Topic too long (> 200 chars) | `Use 200 characters or fewer` | On input |
| Vague topic (BLD-10) | See 5.3 | Server pre-check before any spend |
| No source in Files mode | `Add a file or URL` | On submit |
| Wrong file type | `Use PDF, Markdown or text` | On add |
| File too big | `Files must be under 20 MB` | On add (limit from config) |
| Too many files | `Up to 10 files` | On add (limit from config) |
| Upload failed | row shows `Upload failed` + `Retry` | Per file |
| PDF with no text | row shows `No text found` | After server extract |
| Bad URL | `Enter a full URL` | On blur |
| URL unreachable | `Couldn't fetch this URL` | Server pre-check |
| Private repo | `Repo not public` | Server pre-check |
| Uploads still running | Button disabled, label `Uploading…` | |
| Build already running | `.card` above the form: `Rust ownership · Building` + `View` | One build at a time per user |
| Offline | Button disabled, label `Offline` | `navigator.onLine === false` |
| Balance below cost | Button stays enabled; pressing opens TopUpSheet (not a disabled button, so the user learns why) | |

Submit sequence: client checks -> server pre-check (topic, URL, files) -> Confirm (cost >= 100, skipped for `Free`) -> `POST /api/build` with an idempotency key -> `#/build/:job`.

Keyboard: tabs follow the ARIA tabs pattern (Left/Right move, Home/End, Tab into the panel). Enter in Topic submits. The drop zone is a real `<button>` that opens a hidden `<input type="file" multiple accept=".pdf,.md,.txt,text/markdown,text/plain,application/pdf">`; drag and drop is an extra. Upload progress per row is a `role="progressbar"` with `aria-label="Uploading intro.pdf"`.

### 5.2 Confirm spend

```
+------------------------------------+
| Spend 150 credits?                 |
| Balance after: 810                 |
|            [ Cancel ]  [ Build ]   |
+------------------------------------+
```

| Element | Copy |
|---|---|
| Title | `Spend 150 credits?` |
| Body | `Balance after: 810` |
| Buttons | `Cancel` (`.btn.ghost`), `Build` (`.btn`, initial focus) |

Esc and backdrop cancel. Used for every spend of 100+ (all three build modes today).

### 5.3 Vague topic

Server pre-check returns suggestions instead of starting a job. Nothing is charged.

```
| Topic                                                  |
| [python_______________________________________]        |
| Topic too broad                                        |  role="alert"
| [ Python asyncio ]  [ Python packaging ]  [ Python typing ] |  .tag buttons
```

- Copy: `Topic too broad`. Suggestion chips are buttons that fill the field and move focus to the build button.
- Empty suggestions: only `Topic too broad`.

### 5.4 Build progress `#/build/:job`

Survives reload and navigation [BLD-7]: the job id is in the URL, Home shows a running card, and the page polls `GET /api/build/:job` every 2 s (or SSE).

```
+------------------------------------------------------------+
| [<-] Rust ownership and borrowing                          |
|                                                            |
|  [Questie: think]                                          |
|                                                            |
|  ✓ Outline                                                 |
|  ● Writing levels         3 / 8                            |
|    [===========-----------------]                          |
|  ○ Checking                                                |
|  ○ Saving                                                  |
|                                                            |
|  Outline                                                   |  h2, appears when ready (BLD-9)
|  1 What ownership is                       ✓               |
|  2 Moves and copies                        ✓               |
|  3 Borrowing                               ✓               |
|  4 Mutable references                      writing         |
|  5 Lifetimes                                               |
|  6 Slices                                                  |
|  7 Smart pointers                                          |
|  8 Boss: a borrow-checked cache                            |
|                                                            |
|  Courses                                                   |  .btn.ghost, leave freely
+------------------------------------------------------------+
```

Steps by mode:

| Mode | Steps |
|---|---|
| Topic | `Outline`, `Writing levels`, `Checking`, `Saving` |
| Files | `Reading files`, `Outline`, `Writing levels`, `Checking`, `Saving` |
| Web research | `Researching` (count: `14 sources`), `Outline`, `Writing levels`, `Checking`, `Saving` |

- When the fix loop runs, `Checking` shows `Fixing 2 issues` under it.
- Step markers: `✓` done, `●` current, `○` waiting; each step's state is also in text for screen readers (`Outline, done`).
- The current step label is in an `aria-live="polite"` region; level-by-level updates are not announced (too chatty), only step changes.
- Overall `role="progressbar"` on the writing bar, `aria-valuetext="3 of 8 levels"`.
- No cancel in v1 (no partial-refund rule exists).

### 5.5 Build result

Success:

```
+------------------------------------------------------------+
| [<-] Rust ownership and borrowing                          |
|  [Questie: cheer]                                          |
|                                                            |
|  Course ready                                              |
|  8 levels · 64 challenges · 6 katas · 9 challenge types    |
|  23 sources                                  (research)    |
|                                                            |
|  [ Start ]   [ Share ]                                     |
|                                                            |
|  Outline                                                   |
|  1 What ownership is                                       |
|  …                                                         |
+------------------------------------------------------------+
```

| Element | Copy |
|---|---|
| Title | `Course ready` |
| Stats | `8 levels · 64 challenges · 6 katas · 9 challenge types`; research adds `23 sources` |
| Buttons | `Start` (Map, autofocus), `.btn.ghost` `Share` (5.7 dialog) |

Failure (refund is automatic, CRD-4):

```
|  [Questie: sad]                                            |
|  Build failed                                              |
|  150 credits refunded                                      |  .pill-ok
|  [ Try again ]  [ Edit ]                                   |
```

| Case | Title | Line | Actions |
|---|---|---|---|
| Model / validation failure | `Build failed` | `150 credits refunded` | `Try again` (same input, new idempotency key, Confirm again), `.btn.ghost` `Edit` (back to `#/build` with the form filled) |
| Free course build failed | `Build failed` | `Free course restored` | same |
| Billing off | `Build failed` | none | same |
| Job not found / not owner | `Build not found` | | `Courses` |
| Polling error | Keep last state + `Connection lost` (status) and retry with backoff | | |

Focus moves to the result title (`tabIndex=-1`) when the job ends; the title is announced.

### 5.6 Citations

Research courses carry source links per theory card [BLD-3]. Render them in the existing Theory card (`src/engine/Theory.tsx`) and on Materials.

```
+--------------------------------------------------------+
| Borrowing                                              |
|                                                        |
| A reference lets code read a value without taking      |
| ownership.[1] Only one mutable reference may exist at  |
| a time.[2]                                             |
|                                                        |
| ------------------------------------------------------ |
| Sources                                                |  h3, small
| 1 References and Borrowing · doc.rust-lang.org    ↗    |
| 2 The Rustonomicon: Aliasing · doc.rust-lang.org  ↗    |
+--------------------------------------------------------+
```

- Inline markers are `<sup><a href="#src-<card>-1">1</a></sup>` with `aria-label="Source 1"`; they jump to the list item, not off-site.
- List items: title, domain in `--muted`, external link opening in a new tab with `rel="noopener noreferrer"` and an icon `ArrowSquareOut` with `<span class="sr">opens in new tab</span>`.
- Copy: section title `Sources`.
- Materials screen: new section `Sources` per level listing all cited links, deduped.
- Cards with no citations (topic and files modes) show nothing. Files-mode cards may cite the uploaded file name as plain text (`intro.pdf, p. 12`) when the builder returns it.

### 5.7 Share and publish (owner)

Map header of an owned course adds `.btn.ghost` `Share`. Library courses and other users' courses do not show it.

```
+--------------------------------------------+
| Share course                          [x]  |
| Private                                    |  .pill status
|                                            |
| [ Copy link ]                              |
| [ Submit to library ]                      |
|                                            |
| [ Download file ]   [ Upload new version ] |  .btn.quiet
+--------------------------------------------+
```

| Status | Pill | Actions |
|---|---|---|
| private | `Private` | `Copy link`, `Submit to library` |
| link | `Link` | `Copy link`, `Submit to library`, `Make private` |
| pending | `.pill-mid` `In review` | `Copy link`, `Make private` |
| public | `.pill-ok` `In library` | `Copy link` |
| rejected | `.pill-bad` `Rejected` + reason line | `Copy link`, `Submit again`, `Make private` |

- `Copy link` makes the course `link` if private, copies the URL, label changes to `Copied` for 2 s (`role="status"`).
- `Submit to library` -> Confirm `Submit to library?` with body `Published under CC BY 4.0.` and buttons `Cancel` / `Submit`. The license line passes the test: it changes what the user gives away [LIC-3].
- `Make private` -> Confirm `Make private?` body `Shared links stop working.` buttons `Cancel` / `Make private`.
- `Download file` downloads `<id>.json` (plan answer 7).
- `Upload new version` opens a file picker (`.json`), validates on the server; success `Course updated`; failure lists validation errors in a `<details>` (`Invalid course`, same as Home's `course-error`). Progress on unchanged ids is kept [BLD-12].
- Errors: `Couldn't update` (alert) for any failed status change.

## 6. Narrated lesson player

Lives at the top of the Theory view in Level (`phase === "theory"`). A "lesson" is one level's theory cards; audio is one segment per card, bought once per lesson + voice [NAR-1, NAR-2].

```
Locked (not bought)
+--------------------------------------------------------+
| [ ▶ Listen · 10 ]                                      |  .btn.ghost
+--------------------------------------------------------+

Preparing
| [ … Preparing audio ]  (disabled, aria-busy)           |

Ready / playing
+--------------------------------------------------------+
| [❚❚]  ===========o------------  1:12 / 4:30   [1x]     |
+--------------------------------------------------------+
| card 3 of 7 ...                                        |  existing Theory card below
```

| Element | Copy / name |
|---|---|
| Buy button | `Listen · 10`; `Listen` when already paid by this user, when the lesson audio is free for them, or billing off |
| Preparing | `Preparing audio` |
| Play / pause | `aria-label` `Play` / `Pause` |
| Scrubber | `<input type="range">` `aria-label="Position"`, `aria-valuetext="1:12 of 4:30"` |
| Time | `1:12 / 4:30` |
| Speed | `1x` -> `1.25x` -> `1.5x` -> `0.75x` cycle; `aria-label="Speed 1x"` |
| Failure | `Audio failed · 10 credits refunded` (alert) + `Retry` |
| Play error (network) | `Couldn't play audio` + `Retry` |

Behaviour:

- Starting playback plays the current card's segment; at its end the Theory card advances and the next segment plays. Moving cards by hand (Previous / Next / dots / arrow keys) jumps audio to that card's segment.
- Pausing stays on the card. Leaving the level stops audio.
- Charge happens on first `Listen · 10` per user + lesson + voice; replays and other cards are free. A cache hit generated by someone else still charges this user once (plan answer 2).
- One voice in v1; the voice id is part of the cache key for later.
- Media Session metadata: title = level title, artist = `Questie`, album = course title; lock-screen play / pause / next / previous map to the player.
- The Hud mute applies to game sound only; narration has its own controls.

Keyboard: `Space` toggles play when focus is not in a field or on a button (reuse `typingTarget`); `Left` / `Right` keep moving cards as today. All controls are reachable by Tab in visual order.

## 7. Grade and stronger answer

Changes to `WrittenAnswer` and `GradeView`. Grade and Stronger answer are separate calls [CRD-8].

```
edit
| [textarea: Your answer]                         [mic] |
| [ Grade · 2 ]   [ Show model answer ]                 |

graded
| (7)  Covered: …   Missing: …   Mistakes: …           |  GradeView without "Stronger answer"
| Model answer                                          |
| …                                                     |
| [ Stronger answer · 3 ]                               |  .btn.ghost

stronger (after the second call)
| Stronger answer                                       |  .gv-improved
| …                                                     |
| Corrections                                           |
| "ownership is copied"  ->  "ownership moves"          |
| "&mut can be shared"   ->  "one &mut at a time"       |
```

| Element | Copy |
|---|---|
| Grade button | `Grade · 2` -> `Grading…`; inside a paid mock session: `Grade` |
| Stronger button | `Stronger answer · 3` -> `Writing…` |
| Section titles | `Stronger answer`, `Corrections` |
| Correction row | quoted original -> fix, as two `<span>`s in a list; screen reader text `"ownership is copied", change to "ownership moves"` |
| Grade failed | `Grader unavailable · 2 credits refunded` then self-rating (as today) |
| Grade timeout | `Grader timed out · 2 credits refunded` then self-rating |
| Stronger failed | `Couldn't write it · 3 credits refunded` + `Retry` |
| 402 | TopUpSheet; the answer text stays in the field |
| `ai` off | No Grade button; `Show model answer` + self-rating as today |

- Ctrl/Cmd+Enter still grades (`aria-keyshortcuts` kept).
- Stronger answer is offered only after a successful grade and only once per graded attempt.
- The stronger answer and corrections are saved with the attempt and show in Answers (`src/screens/Answers.tsx`) and in `Previous attempts`.

## 8. Mock exam

Changes to `MockScreen` intro and end states. One debit of 20 per session; grading inside is free [CRD-9].

```
intro
| [<-] Exam                                              |
| 10 questions · 30:00                  [ Start · 20 ]   |
```

| State | UI |
|---|---|
| Intro | `10 questions · 30:00` + `Start · 20` (`Start` when billing off) |
| Starting | `Starting…`, button disabled |
| 402 | TopUpSheet |
| Start failed | `Couldn't start exam` (alert); nothing charged |
| Running | As today; Grade buttons read `Grade` (no cost) |
| Reload during run | Resumes the same session from `sessionStorage` (`ql.mock.<course>`: session id, end time, index); no new charge |
| Clock ends | End screen as today |
| Exam failed server-side before any grade | `Exam failed · 20 credits refunded` + `Try again` |
| `ai` off | No mock button on the Map; the screen itself shows `No grader` if opened by URL |

## 9. Home and Library

### 9.1 Home `#/` (changed)

Home lists courses the user owns or has progress in, plus running builds.

```
+------------------------------------------------------------+
| Hud                                                        |
| +--------------------------------------------------------+ |
| | Rust ownership                         Building 3 / 8  | |  running job card -> #/build/:job
| | [=========-----------]                                 | |
| +--------------------------------------------------------+ |
| +--------------------------------------------------------+ |
| | [art] HTTP basics                                      | |  existing .course-card
| |       4/8 levels · 9★ · 3 due                          | |
| +--------------------------------------------------------+ |
| +--------------------------------------------------------+ |
| | [R]   Tokio internals                       [Link]     | |  owned course, status pill
| |       0/7 levels · 0★                                  | |
| +--------------------------------------------------------+ |
+------------------------------------------------------------+
```

| State | UI |
|---|---|
| Courses exist | List as today, owned courses add a status pill (`Private` hidden; `Link`, `In review`, `In library`, `Rejected`) |
| Running build | Card first: title, `Building 3 / 8` (or current step name), progress bar |
| Failed build (unseen) | Card first: title, `.pill-bad` `Build failed`, link to the job |
| Empty | `No courses` + `Build course` + `.btn.ghost` `Browse library` (Build hidden when `ai` off) |
| Courses loading (runtime registry) | Course-card skeletons; no `NotFound` flash for owned course links |
| Load error | `Couldn't load courses` + `Retry`; bundled courses still listed |

### 9.2 Library `#/library`

```
+------------------------------------------------------------+
| Library                                                    |
| [Search courses_____________________]                      |
| [ All ] [ Questie ] [ Community ]                          |  filter, aria-pressed
|                                                            |
| +-------------------------+  +---------------------------+ |
| | [art] HTTP basics       |  | [art] Rust ownership      | |
| | 8 levels · Questie      |  | 8 levels · Ada L. · Cited | |
| +-------------------------+  +---------------------------+ |
| ...                                                        |
+------------------------------------------------------------+
```

| Element | Copy |
|---|---|
| Title | `Library` |
| Search | `aria-label="Search courses"`, placeholder `Search` |
| Filters | `All`, `Questie`, `Community` |
| Card meta | `8 levels · <author>`; author is `Questie` for owner-built, the publisher's name for user courses; `Cited` `.tag` for research courses |
| Empty search | `No matches` |
| Empty library | `No courses` |
| Error | `Couldn't load library` + `Retry` |

- A card opens the Map. The course joins Home once it has progress. No "add" step.
- Search filters client-side on title, summary and tags; results count in a polite live region: `12 courses`.
- Each lesson and challenge gets `Report` (9.3).

### 9.3 Report a problem (BLD-14, Should)

`.btn.quiet` icon button (`Flag`) on each theory card and challenge, `aria-label="Report a problem"`.

```
+------------------------------------+
| Report a problem              [x]  |
| ( ) Wrong                          |
| ( ) Unclear                        |
| ( ) Broken                         |
| ( ) Other                          |
| Details                            |
| [____________________________]     |  optional, 500 chars
|            [ Cancel ]  [ Send ]    |
+------------------------------------+
```

Copy: title `Report a problem`, options `Wrong`, `Unclear`, `Broken`, `Other`, field `Details`, buttons `Cancel`, `Send`. Success: dialog closes, `Report sent` (status) near the flag. Error: `Couldn't send` in the dialog. Send disabled until an option is picked.

### 9.4 Review queue `#/admin/review` (admin)

Link from Profile: `Review queue · 3`. Hidden for non-admins; the route shows `Not found` for them.

```
+------------------------------------------------------------+
| [<-] Review queue                                          |
| [ Pending · 3 ]  [ Reports · 5 ]                           |  tabs
|                                                            |
| +--------------------------------------------------------+ |
| | Rust ownership                          Web research   | |
| | Ada Lovelace · 22 Nov · 8 levels · 23 sources          | |
| | [ Open ↗ ]   [ Approve ]   [ Reject ]                  | |
| +--------------------------------------------------------+ |
| | SQL window functions                    Files          | |
| | …                                                      | |
+------------------------------------------------------------+
```

| Element | Copy |
|---|---|
| Title | `Review queue` |
| Tabs | `Pending · 3`, `Reports · 5` |
| Row meta | `<author> · <date> · <n> levels`, research adds `· <n> sources`; mode tag `Topic` / `Files` / `Web research` |
| Actions | `Open` (new tab, Map), `Approve` (`.btn`), `Reject` (`.btn.ghost`) |
| Reject dialog | title `Reject course?`, field `Reason` (required, shown to the author), buttons `Cancel`, `Reject` |
| Approve | no confirm; row leaves with `Approved` (status); `Undo` for 5 s |
| Empty | `Queue empty` / `No reports` |
| Error | `Couldn't load queue` + `Retry`; action failure `Couldn't update` |

Reports tab rows: course + lesson/challenge title, reason, details, count, date; actions `Open`, `Dismiss`. No keyboard shortcuts here: approve must be a deliberate press.

## 10. Profile, plan and account

`#/profile` keeps the current form and Reminders and adds Plan, Credits, Account. Order:

```
+------------------------------------------------------------+
| [<-] Profile                                               |
|                                                            |
| (existing form: Email, Name, Title, Location, Link, Bio)   |
| [ Save ]                                                   |
|                                                            |
| Plan                                                       |  h2
| Questie · €11.99 / month                                   |
| Renews 22 Dec                                              |
| [ Manage ]                                                 |  Stripe portal
|                                                            |
| Credits                                                    |  h2
| 960 · 860 plan · 100 top-up                                |
| [ Top up ]   [ History ]                                   |
|                                                            |
| (existing Reminders)                                       |
|                                                            |
| Review queue · 3                                           |  admin only, link
|                                                            |
| Account                                                    |  h2
| [ Sign out ]                                               |
| [ Delete account ]                                         |  .btn.quiet, --bad text
+------------------------------------------------------------+
```

Plan section states:

| State | Lines | Button |
|---|---|---|
| Free | `Free` | `Subscribe` (-> `#/plans`) |
| Active (Stripe) | `Questie · €11.99 / month`, `Renews 22 Dec` | `Manage` (portal; label `Opening…` while busy) |
| Canceled, active | `Questie · €11.99 / month`, `.pill-mid` `Ends 22 Dec` | `Manage` |
| Past due | `.pill-bad` `Payment failed` | `Update payment` |
| App Store / Google Play | `Questie · App Store` | Native: `Manage` (opens store subscriptions). Web: none |
| Portal open failed | `Couldn't open billing` (alert) | |

- Email field shows the account email (read-only, as today); `/me.user` is no longer shown as the email.
- `Sign out` calls Better Auth sign-out [ACC-9], then `#/signin`. It does not wipe local progress for the same user on next sign-in [ACC-8].
- Billing off: no Plan or Credits section.

### 10.1 Delete account

```
+--------------------------------------------+
| Delete account?                            |
| Progress, courses, answers, notes and      |
| credits are deleted. This can't be undone. |
| Type your email                            |
| [________________________]                 |
|          [ Cancel ]  [ Delete account ]    |  destructive .btn with --bad
+--------------------------------------------+
```

| Element | Copy |
|---|---|
| Title | `Delete account?` |
| Body | `Progress, courses, answers, notes and credits are deleted. This can't be undone.` |
| Field | `Type your email` |
| Buttons | `Cancel` (initial focus), `Delete account` (enabled only when the email matches) |
| Active Stripe plan | extra line `Your plan is canceled now.` |
| Active store plan | extra line `Cancel your App Store subscription first.` + `.btn.quiet` `Manage` (native) |
| Busy | `Deleting…` |
| Failure | `Couldn't delete account` (alert) |
| Success | signed out, `#/signin` with `Account deleted` (status) |

Required in-app on iOS and Android (store rules). Open question: whether courses already `In library` stay public under CC BY 4.0 after deletion (see section 15).

## 11. Course map changes

- Owned course: `Share` button (5.7) in `.map-head`.
- `course.mock` button label stays the mock title; cost appears on the Start button inside (8), not on the Map.
- Shared link opened by a non-owner: Map as usual, no Share. Private course opened by a non-owner: `Course not found` (existing NotFound) so private ids are not confirmed.
- Research courses: Materials tab shows `Sources` (5.6).

## 12. Mobile (Capacitor)

### 12.1 Safe areas and layout

- `viewport-fit=cover` in `index.html`. Body already pads left, right and bottom with `env(safe-area-inset-*)`; add `padding-top: env(safe-area-inset-top)` to the sticky `.hud` so it clears the notch and status bar.
- `.overlay` already pads all four insets. The bottom sheet adds `padding-bottom: max(var(--s-4), env(safe-area-inset-bottom))` and rounds only the top corners.
- Full-page auth screens pad top with the inset.
- At <= 520 px the Hud wraps: row 1 brand, CreditChip, streak; row 2 nav (`Courses`, `Library`, `Build`, `Profile`), scrolling horizontally as `.hud-nav` already does. The volume slider is hidden on native (hardware buttons); the mute button stays.
- Status bar style follows the color scheme (dark text on paper, light on graphite).
- Android back button: closes an open dialog or sheet first, else `history.back()`, else exits from Home.

### 12.2 Native sign-in

- Same screens as 2.1 / 2.2. Google and Apple open native sheets (ID token flow, MOB-3). On iOS the Apple button is listed first.
- Password fields keep `autocomplete` values so the iOS / Android password managers fill them.
- Email links (verify, reset, magic link) open the app through universal links / app links when installed, else the web app.
- Session token lives in Keychain / Keystore; nothing changes on screen.

### 12.3 IAP sheet

Replaces TopUpSheet and Plans buttons on native. Prices come from RevenueCat offerings in the store's currency.

```
+------------------------------+
| Not enough credits      [x]  |
| Needs 150 · You have 40      |
| [ Subscribe · €11.99/mo   ]  |  store price string
|   1,000 credits / month      |
| [ 500 credits · €5.99     ]  |
| [ 1,500 credits · €14.99  ]  |
| Restore purchases            |  .btn.quiet (iOS)
+------------------------------+
```

| State | UI |
|---|---|
| Offerings loading | Buttons as skeletons, `aria-busy` |
| Offerings failed | `Store unavailable` + `Retry` |
| Purchasing | Pressed button `Purchasing…`, all disabled, sheet not closable |
| User canceled store sheet | Back to the sheet, no message |
| Paid, waiting for ledger | `Adding credits…` (poll balance every 2 s, up to 30 s) |
| Credits landed | `Credits added` / `Subscribed` (status), sheet closes after 1 s, balance updates |
| Ledger not seen after 30 s | `Credits pending` + `Refresh` |
| Pending approval (Ask to Buy) | `Waiting for approval` |
| Store error | `Purchase failed` |
| Restore | `Restoring…` then `Purchases restored` or `Nothing to restore` |
| Already subscribed via web | Subscribe option hidden; packs only |

- No Stripe links or web prices anywhere in the native app. Plans in native shows the same cards and credit table, with store prices and IAP actions.
- Same credit amounts as the web; store price tier nearest to the web price (plan answer 4).
- The `VAT included` line is omitted on native (store prices are shown as the store formats them).

### 12.4 Other native behaviour

- Narration keeps playing with the screen locked (background audio mode); lock-screen controls via Media Session (6).
- Reminders: the existing `Enable notifications` button triggers the OS permission prompt for native push; `Notifications are blocked` stays when denied, plus `.btn.quiet` `Open settings` on native.
- File builder on native: `Add files` opens the system document picker (PDF, Markdown, text). No drag and drop.
- Offline: AI buttons disabled with label `Offline`; practice works as today.
- Haptics: none added.

## 13. Keyboard and accessibility

### 13.1 Rules for every new screen

- One `h1` per screen. On route change, focus moves to the `h1` (`tabIndex=-1`) for the new routes in this doc, so screen readers announce the screen.
- Every input has a visible `<label>`. Errors use `aria-invalid` and `aria-describedby`; the first invalid field gets focus on submit.
- Status messages use `role="status"`; failures use `role="alert"` (matches existing code).
- Targets are at least 44 x 44 px (existing `.btn`, `.back`, `.iconbtn`).
- `:focus-visible` outline stays the global 2 px accent.
- Colour is never the only signal: deltas have signs, pills have words, steps have text states.
- `prefers-reduced-motion`: the existing global rule covers new animations; Questie mood changes still swap the face but do not bounce.
- Text scales to 200 % without horizontal scroll at 320 px width.
- Contrast: only tokens from `global.css`, which pass AA in both schemes.

### 13.2 Cost buttons

Visible `Build course · 100`. Markup:

```html
<button class="btn">Build course <span aria-hidden="true">·</span> 100<span class="sr"> credits</span></button>
```

Accessible name: `Build course 100 credits`. With the free course: `Build course · Free` (name `Build course Free`).

### 13.3 Dialogs and sheets

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` on the title, `aria-describedby` on the body line when there is one.
- Focus trap inside, Esc closes (except while purchasing or deleting), backdrop click closes non-destructive dialogs only.
- Initial focus: the safe action for destructive dialogs (`Cancel`), the primary action otherwise.
- Focus returns to the trigger on close. Body scroll is locked while open (same as `LevelUp`).

### 13.4 Shortcuts

| Where | Key | Action |
|---|---|---|
| Written answer | Ctrl/Cmd+Enter | Grade (existing) |
| Theory | Left / Right | Previous / next card (existing) |
| Theory with audio ready | Space | Play / pause |
| Builder tabs | Left / Right, Home / End | Switch mode |
| Any dialog | Esc | Close |
| Forms | Enter | Submit |

No single-letter shortcuts (they collide with screen-reader keys). No shortcuts in the review queue.

### 13.5 Timed content

Mock exams and timed challenges keep their visible `role="timer"`; announcements are limited to the last 60 s (the existing `low` state). X-3 (screen-reader path for games) is out of this doc's scope beyond: AI features never depend on a timed game.

## 14. Copy index

Every new string, for review in one place. Dynamic parts in `<>`.

| Area | Strings |
|---|---|
| Brand | `Questie` |
| Nav | `Courses`, `Library`, `Build`, `Profile` |
| Auth | `Sign in`, `Create account`, `Continue with Google`, `Continue with Apple`, `or`, `Email`, `Password`, `Name`, `Show`, `Hide`, `Signing in…`, `Creating…`, `Forgot password?`, `Have an account?`, `Terms`, `Privacy`, `8+ characters`, `Email me a link`, `Link sent`, `Check your email`, `Resend email`, `Resend in <m:ss>`, `Email sent`, `Change email`, `Reset password`, `Send link`, `New password`, `Save password`, `Send new link`, `Link expired` |
| Auth errors | `Wrong email or password`, `Email not verified`, `Too many attempts. Wait a minute.`, `Couldn't connect`, `Google sign-in failed`, `Apple sign-in failed`, `Use Google to sign in`, `Use Apple to sign in`, `Use your password to sign in`, `Email already registered`, `Password needs 8+ characters`, `Enter a valid email`, `Name is required` |
| Onboarding | `What do you want to learn?`, `Skip`, `Browse library` |
| Builder | `New course`, `Topic`, `Files`, `Web research`, `Level`, `Beginner`, `Intermediate`, `Advanced`, `Add files`, `or drop here`, `URL or repo`, `Build course · <n>`, `Build course · Free`, `Uploading…`, `Offline`, `View`, `Building` |
| Builder errors | `Enter a topic`, `Use 200 characters or fewer`, `Topic too broad`, `Add a file or URL`, `Use PDF, Markdown or text`, `Files must be under <n> MB`, `Up to <n> files`, `Upload failed`, `Retry`, `No text found`, `Enter a full URL`, `Couldn't fetch this URL`, `Repo not public` |
| Build job | `Reading files`, `Researching`, `<n> sources`, `Outline`, `Writing levels`, `Checking`, `Fixing <n> issues`, `Saving`, `Course ready`, `Start`, `Share`, `Build failed`, `<n> credits refunded`, `Free course restored`, `Try again`, `Edit`, `Build not found`, `Connection lost` |
| Confirm | `Spend <n> credits?`, `Balance after: <n>`, `Cancel`, `Build` |
| Citations | `Sources`, `Source <n>`, `opens in new tab` |
| Share | `Share course`, `Private`, `Link`, `In review`, `In library`, `Rejected`, `Copy link`, `Copied`, `Submit to library`, `Submit to library?`, `Published under CC BY 4.0.`, `Submit`, `Submit again`, `Make private`, `Make private?`, `Shared links stop working.`, `Download file`, `Upload new version`, `Course updated`, `Invalid course`, `Couldn't update` |
| Narration | `Listen · 10`, `Listen`, `Preparing audio`, `Play`, `Pause`, `Position`, `Speed <x>`, `Audio failed · 10 credits refunded`, `Couldn't play audio` |
| Grading | `Grade · 2`, `Grade`, `Grading…`, `Stronger answer · 3`, `Writing…`, `Stronger answer`, `Corrections`, `Grader unavailable · 2 credits refunded`, `Grader timed out · 2 credits refunded`, `Couldn't write it · 3 credits refunded` |
| Mock | `Start · 20`, `Starting…`, `Couldn't start exam`, `Exam failed · 20 credits refunded`, `No grader` |
| Home / Library | `No courses`, `Build course`, `Building <i> / <n>`, `Couldn't load courses`, `Library`, `Search courses`, `Search`, `All`, `Questie`, `Community`, `Cited`, `<n> levels`, `<n> courses`, `No matches`, `Couldn't load library` |
| Report | `Report a problem`, `Wrong`, `Unclear`, `Broken`, `Other`, `Details`, `Send`, `Report sent`, `Couldn't send` |
| Review queue | `Review queue`, `Review queue · <n>`, `Pending · <n>`, `Reports · <n>`, `Open`, `Approve`, `Reject`, `Reject course?`, `Reason`, `Approved`, `Undo`, `Dismiss`, `Queue empty`, `No reports`, `Couldn't load queue` |
| Plans | `Plans`, `Free`, `€0`, `€11.99 / month`, `1,000 credits / month`, `Every library course`, `Games, katas, review, notes`, `1 AI course`, `Everything in Free`, `AI courses from topics, files and web research`, `AI grading`, `Narrated lessons`, `Subscribe`, `Current plan`, `Manage`, `Update payment`, `Ends <date>`, `Payment failed`, `VAT included`, `Top-ups`, `<n> credits`, `Buy`, `Top-up credits never expire`, `Credit costs`, `Plan credits reset each month. Spent before top-ups.`, `Opening checkout…`, `Couldn't open checkout`, `Checkout canceled`, `New credit costs from <date>` |
| Top-up | `Not enough credits`, `Needs <n> · You have <n>`, `Top up`, `Balance <n>`, `Subscribe · €11.99/mo`, `Close`, `<n> credits left`, `Dismiss` |
| Credits | `Credits`, `<n> plan · <n> top-up`, `Plan credits reset <date>`, `History`, `Monthly credits`, `Plan reset`, `Top-up`, `Purchase reversed`, `Course: <title>`, `Course build`, `Refund: build failed`, `Refund: grading failed`, `Refund: audio failed`, `Refund: mock exam failed`, `Grade × <n>`, `Stronger answer × <n>`, `Mock exam: <course>`, `Narration: <level>`, `No activity`, `Couldn't load credits`, `Show more`, `Loading…`, `<n> credits` (chip name) |
| Stripe return | `Confirming payment…`, `Subscribed`, `Credits added`, `+<n> credits`, `Payment processing`, `Credits added when payment clears`, `Payment not completed`, `Still confirming`, `Refresh`, `Payment not found`, `Continue` |
| Profile | `Plan`, `Renews <date>`, `Questie · App Store`, `Opening…`, `Couldn't open billing`, `Account`, `Sign out`, `Delete account` |
| Delete | `Delete account?`, `Progress, courses, answers, notes and credits are deleted. This can't be undone.`, `Type your email`, `Your plan is canceled now.`, `Cancel your App Store subscription first.`, `Deleting…`, `Couldn't delete account`, `Account deleted` |
| Native | `Restore purchases`, `Restoring…`, `Purchases restored`, `Nothing to restore`, `Purchasing…`, `Adding credits…`, `Credits pending`, `Waiting for approval`, `Purchase failed`, `Store unavailable`, `Open settings` |

## 15. Open points for the coordinator

These need an answer before implementation; the doc picks a default so work is not blocked.

1. **One build at a time per user.** Default: yes (simplest refund and progress story). Alternative: a small queue.
2. **Upload limits.** Default: 10 files, 20 MB each, PDF / Markdown / text. Values go in the config module.
3. **Public courses after account deletion.** Default: deleted with the account. Alternative: stay in the library under CC BY 4.0 with the author shown as `Former user`.
4. **No cancel for a running build in v1.** Default: no cancel button. Adding one needs a refund rule for partial work.
5. **Low-balance threshold.** Default: below 100 credits (one topic course).
