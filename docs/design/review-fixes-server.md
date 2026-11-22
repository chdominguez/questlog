# Review fixes: server, shared, client API (branch fix-server)

Merged with `questie` at 67a8e73 (includes fix-ux). Checks on the merged result: `npm test` 297/297, `typecheck`, `validate`, `build`, `site:build`, `e2e` 11/11 all pass.

## Correctness (review-correctness.md)

| # | Finding | Result |
|---|---|---|
| 1 | Stored XSS through course art | 319a70f: user courses may not carry `art`; `artProblem` rejects event handlers, foreignObject, img, embeds, animation; runtime art goes through DOMPurify (SVG profile) before `addArt`. 1cf7a46: CSP `script-src 'self'` on app pages |
| 2 | One idempotency key buys unlimited AI calls | cb8b8e4: `spend` conflicts on another ref; `charge` returns 409 `idempotency_conflict` on a replay and never runs the model; narration replay is 409 |
| 3 | Narration flat price, unbounded TTS | 308fdfb: 12,000 narrated characters per lesson (bundled lessons are about 2,500), 400 `too_large` above it |
| 4 | Kata code runs same-origin with the viewer's session | dba8745: the runner worker removes fetch, XHR, WebSocket, EventSource, WebTransport, importScripts, Worker, caches, BroadcastChannel before course code runs; the API refuses `Sec-Fetch-Dest` script/json/style/worker requests (the `import()` read that JS cannot block). Checked in Chromium: all undefined in the worker, JSON import of `/api/me` gets 403 |
| 5 | Concurrent build requests start two builds | ffae36e: key and active-build checks repeated with spend and enqueue in one transaction |
| 6 | Plan credits refunded after expiry never expire | eb01cd9: refund writes an immediate `plan_expire` for the plan share when the plan has ended |
| 7 | Interrupted narration job refunded but keeps its unlock | 9084119: `failJob` deletes the unlock with the refund, on every failure path |
| 8 | Account deletion leaves rows behind | 9f9a4aa: Stripe events for unknown users write nothing; `finish` adds its event only when the job row was updated; a build whose job row is gone does not save its course |
| 9 | `wipeLocal` leaves cached courses and legacy progress | 599b12d: also removes `ql.courses`, `ql.me`, `ql.seenJobs`, `ql.lowWarned`, the legacy key and `eq2.kata.*` |

## Security (review-security.md)

| # | Finding | Result |
|---|---|---|
| 1 | Stored XSS through art | Correctness 1 |
| 2 | MCP API key gets full account access via `/api/auth/*` | 85db9f4: `x-api-key` stripped before Better Auth |
| 3 | Idempotency replay | Correctness 2 |
| 4 | Narration spend per unlock | 308fdfb: character cap, and a user-course unlock covers one lesson version (edited lesson needs a new unlock) |
| 5 | Grader input unbounded | 19d3584: prompt + model + key points + persona capped at 20,000 characters on PUT and at grade/improve time |
| 6 | Approval not bound to the reviewed version | 3dd1a51: approve/reject send `version`; mismatch is 409 |
| 7 | Uploads left in the Files API after deletion | 7aea785: deleted at account deletion; a failed delete leaves the row ownerless for the 24 h sweep |
| 8 | `PUT /courses/:id` sandbox abuse | cf992d5: 20 per hour, at most 30 katas (checked before any sandbox run), at most 4 sandbox children per process |
| 9 | RevenueCat sandbox events grant credits | 2bb8b1d: ignored unless `REVENUECAT_SANDBOX=1` |
| 10 | No body limit on `/auth/*`, `/webhooks/*` | 4ba1628: 256 KB |
| 11 | Remote images in course markdown | dc3a49d: images only from the app, its API origin or `data:` |

## Performance (review-performance.md)

| # | Finding | Result |
|---|---|---|
| 1 | Builds block narration; player gives up after 5 min | b747fb2: narration has its own lane (JOB_CONCURRENCY per lane). 657d06f: the player checks the job instead of giving up |
| 2 | fsync per commit | 8e794af: `synchronous = NORMAL` |
| 3 | New screens and auth client in the main chunk | fe50612: 8 screens lazy, Better Auth client loaded on use. Initial JS 799 KB / 245 KB gzip -> 736 KB / 229 KB |
| 4 | Job inputs parsed on every poll | 2e0177d: `idem_key` and `mode` columns (migration 0012), lists skip `input`, Home job cards poll with `after` |
| 5 | Reminder sweep overlaps; FCM fetch has no timeout | ee0d184: next sweep starts after the last ends; due rows marked in one tx before sending; 10 s timeouts on FCM and web push |
| 6 | Missing indexes | 704d0f5: migration 0013 with the five indexes; sweep deletes expired mock sessions |
| 7 | Course list reads full JSON | 4583ff6: metadata columns only; `findCourse` reads JSON only on a cache miss |
| 8 | Narration waits for the whole lesson; native downloads again | 657d06f: tracks made three at a time; a card plays once its own track is ready; native blob URLs kept for the lesson |
| 9 | Heartbeat written but never read | Rejected: the plan fixes a 15 s heartbeat (questie.md, WP5); with finding 2 each beat costs about 0.05 ms |
| 10 | Hero downloads both theme screenshots | 88ca9e4: the dark variant loads lazily |

## Extra (coordinator)

- UX H1, server side: f435cd5. `POST /mock` accepts any course with written challenges; 30 minutes when the course has no `mock` block.

## Not covered by a test

- 9f9a4aa: the build-save skip and the `finish` guard (the Stripe part has a test).
- 319a70f: the client DOMPurify pass (vitest runs without a DOM; DOMPurify returns input unchanged there, so the code drops runtime art when DOMPurify is unsupported).
- 657d06f, fe50612: client player and lazy loading; covered by the E2E narration and sign-in steps.
