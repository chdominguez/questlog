# Review round 2 fixes (branch fix-round2)

Fixes for `review-round2.md` and the QA list in `qa/qa-report.md`. Checks: `npm test` 305/305, `typecheck`, `validate`, `build`, `site:build`, `e2e` 13/13 all pass.

## Round 2

| # | Finding | Result |
|---|---|---|
| N1 | Kata code can read the session token through `/api/auth/*` | 8c3beb0: the `Sec-Fetch-Dest` refusal runs right after `cors`, before `/health`, `/auth/*` and `/webhooks/*`. The kata worker script gets its own CSP (`default-src 'none'`, scripts and connects only to Pyodide's CDN), so course code can't send a request to this origin or any other. Tests: get-session and list-sessions with a cookie and `Sec-Fetch-Dest` json/script get 403 and no token; e2e checks in Chromium that a JSON import of both is refused and that the real worker can't import from this origin while a kata still passes. Each layer turned off alone fails the e2e. Python katas checked under the worker CSP in Chromium |
| N2 | Lazy screens with no error boundary | ae80239: `ErrorBoundary` around the lazy screens reloads once (at most once a minute per tab) on a chunk-load error, otherwise shows `Failed to load` with `Retry`. e2e aborts the Credits chunk: one reload, then Retry, then Credits loads |
| R1 | Pre-0011 unlocks read as locked | 077bfa2: a `NULL` version counts as the current one and is stored on that read |
| R2 | Edited lesson shows `Audio failed · 10 credits refunded` | 454c7ee: when the poll sees the lesson locked, the player asks the job; only a failed job shows the refund, otherwise the lesson shows `Listen` again |
| R3 | Plan credits refunded after a renewal roll into the new period | eddfdc5: the plan share also expires when a `plan_grant` was written after the spend |
| R4 | One account can hold every sandbox slot | 04acf76: one PUT validation per user at a time; a second one gets 409 `in_progress` |
| R5 | Page CSP allows all of jsDelivr | 8c3beb0: narrowed to `https://cdn.jsdelivr.net/pyodide/` |
| R6 | 12k-character cap vs the 10-credit price | Rejected: 10 credits sell for about EUR 0.10-0.12, and `eleven_multilingual_v2` list prices put even a 1,000-character lesson near that. No cap keeps the margin on uncached user-course lessons without refusing narration for normal lessons. Needs a pricing decision (price per character or a cheaper model), not a cap change |
| L10 | Welcome flag in localStorage | Stays rejected |

## QA

| # | Finding | Result |
|---|---|---|
| 1 | CSP blocks confetti's blob worker | 93fbb88: confetti runs on the main thread (`useWorker: false`). `server/e2e.ts` already sends the CSP; e2e now fails on any CSP violation in the console, and the level clear in the flow fires confetti |
| 2 | `/demo/` calls `/api/me` and `/api/jobs` | c1b1684: Home skips both in the demo. Checked: the built `/demo/` makes no `/api` request and logs no error |
| 3 | Expected 401/404 logged as console errors | Rejected: the app logs none of them; Chrome logs every non-2xx fetch itself. Removing them means changing the API (`GET /progress` 404 when empty, `/me` 401 signed out) |
| 4 | Empty word-bank blank has no name | 425d085: `aria-label="Blank N"` while empty, its value once filled |
| 5 | True/false renders as `Select all` checkboxes | 425d085: rendered as single choice in fixed True/False order, kicker `True or false` |
