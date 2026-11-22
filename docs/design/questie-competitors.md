# Questie: implementation prior art

Research for the build in `questie-plan.md`. Decisions in the plan are final; this file only covers how others built the same pieces and what to copy or avoid. Every claim links to its source. Vendor pages are vendor claims.

Researched 2026-11-22.

## 1. AI course generators

### Comparison

| Product | Input | Output shape | Sources / citations | Quality checks | Gamification | Price model |
|---|---|---|---|---|---|---|
| Oboe | One prompt ([TechRadar](https://www.techradar.com/ai-platforms-assistants/gemini/oboe-just-launched-its-an-ai-powered-platform-that-helps-you-learn-anything)) | Course in nine formats, chapters, flashcards, podcasts ([TechCrunch](https://techcrunch.com/?p=3044797)) | None at launch; reviewers could not verify claims, company said citations were in progress ([TechBuzz](https://techbuzz.ai/articles/ex-spotify-execs-launch-ai-learning-platform-oboe)) | Parallel agents for planning, fact-checking, scripting, image sourcing ([Slashdot](https://slashdot.org/software/p/Oboe/), [TechBuzz](https://www.techbuzz.ai/articles/anchor-co-founders-launch-oboe-ai-learning-app-raises-4m)); no in-app error flagging ([TechBuzz](https://techbuzz.ai/articles/ex-spotify-execs-launch-ai-learning-platform-oboe)) | Not stated | 5 free courses/month, Plus $15 for 30, Pro $40 for 100 at launch ([TechBriefly](https://techbriefly.com/?p=173747)); now "5x usage" / "unlimited" tiers ([Oboe](https://oboe.com/learn/oboe-plan-benefits-explained-1ri2hgs)) |
| Gauth AI Course | Topic ([Product Hunt](https://www.producthunt.com/products/gauth-ai-course)) | Video-story lessons, mindmaps, quizzes; 200+ premade math courses ([K12 Dive](https://www.k12dive.com/press-release/20260831-all-in-one-study-platform-gauth-launches-user-generated-education/)) | Not stated | Not stated; in-lesson AI tutor for questions ([TechNode](https://technode.global/prnasia/gauth-launches-ai-course-feature-to-transform-learning-into-immersive-video-stories/)) | Not stated | Free at launch per one directory ([CompleteAITraining](https://completeaitraining.com/ai-tools/gauth-ai-course/)) |
| NerdSip | Topic | ~7 short lessons with quizzes, swipe cards ([Nibble review](https://nibble-app.com/blog/nerdsip-review), [PCTechMag](https://pctechmag.com/2026/07/nerdsip-review-2026-can-this-ai-powered-microlearning-app-replace-social-media/)) | Not stated | Reviewers: quality varies, less polished than human-written ([Nibble review](https://nibble-app.com/blog/nerdsip-review)) | XP, avatar loot, weekly leagues ([PCTechMag](https://pctechmag.com/2026/07/nerdsip-review-2026-can-this-ai-powered-microlearning-app-replace-social-media/)) | Subscription, ~$7-9/month, AI generation is Pro-only ([Educational App Store](https://www.educationalappstore.com/app/nerdsip), [Nibble review](https://nibble-app.com/blog/nerdsip-review)) |
| Coursebox | Prompt or uploaded document | Outline first, nothing written until "Generate course" ([Coursebox](https://www.coursebox.ai/ai-course-outline-generator.md)); quizzes with answer keys ([Futurepedia](https://www.futurepedia.io/tool/coursebox)) | Grounded in uploaded docs | User reviews outline and gives feedback in chat before generation ([Coursebox support](https://support.coursebox.ai/article/generation-of-course-content)); AI editor after ([Coursebox](https://www.coursebox.ai/)) | None (LMS) | B2B SaaS; reviewers call output generic and quizzes basic ([Capterra](https://capterra.com/p/276074/Coursebox/reviews/)) |
| Khanmigo | Khan Academy content + prompt | Tutor chat, lesson plans | Backed by Khan library content ([Khan blog](https://blog.khanacademy.org/prompt-engineering-using-ai-for-effective-lesson-planning/)) | Teacher rubrics to score outputs; prompt split into chained sections ([Khan blog](https://blog.khanacademy.org/prompt-engineering-using-ai-for-effective-lesson-planning/)); repeated prompt runs and version tracking ([EdWeek](https://www.edweek.org/technology/opinion-can-an-ai-powered-tutor-produce-meaningful-results/2025/07)); A/B tests once a metric existed ([GrowthBook](https://blog.growthbook.io/what-i-learned-from-khan-academy-about-a-b-testing-ai/)); persona testing ([Khan blog](https://blog.khanacademy.org/khan-academys-7-step-approach-to-prompt-engineering-for-khanmigo/)) | None | Institutional |

### Borrow

- **Outline as a separate step the user can see.** Coursebox shows the plan before writing ([source](https://www.coursebox.ai/ai-course-outline-generator.md)). Questie's pipeline already starts with an outline; surface it in the progress UI. Do not add a review gate for topic courses (Oboe and NerdSip ship in seconds without one).
- **Chain small prompts instead of one big one.** Khan found single prompts tried to do too much and fixed it by chaining sections ([source](https://blog.khanacademy.org/prompt-engineering-using-ai-for-effective-lesson-planning/)). Maps to outline -> per-level write -> `validateCourse` -> fix loop.
- **Parallel per-unit writers.** Oboe runs agents in parallel ([source](https://www.techbuzz.ai/articles/anchor-co-founders-launch-oboe-ai-learning-app-raises-4m)). Write levels concurrently after the outline is fixed.
- **Citations on every web-research claim.** Oboe's top complaint is no sources ([source](https://techbuzz.ai/articles/ex-spotify-execs-launch-ai-learning-platform-oboe)). The Anthropic web search tool returns `web_search_result_location` citations on text blocks and supports `max_uses` as a hard cap per request ([docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)). Keep cited URLs in the course file and render them per lesson. Launch price was $10 per 1,000 searches plus tokens ([Anthropic](https://anthropic.com/news/web-search-api)); set `max_uses` so a 200-credit build stays profitable.
- **Rubric evals with repeated runs and prompt versions.** Khan scores outputs with a rubric and reruns each prompt version ([Khan blog](https://blog.khanacademy.org/prompt-engineering-using-ai-for-effective-lesson-planning/), [EdWeek](https://www.edweek.org/technology/opinion-can-an-ai-powered-tutor-produce-meaningful-results/2025/07)). Keep a fixed topic set and check pass rate of `validateCourse` + a rubric score per prompt change.
- **Report-a-problem on each lesson.** Oboe has none and users must email ([source](https://techbuzz.ai/articles/ex-spotify-execs-launch-ai-learning-platform-oboe)). Feeds the review queue.

### Avoid

- Unsourced facts in research courses ([Oboe reviews](https://techbuzz.ai/articles/ex-spotify-execs-launch-ai-learning-platform-oboe)).
- Generic, low-variety output: reviewers flag Coursebox voice and quizzes ([Capterra](https://capterra.com/p/276074/Coursebox/reviews/)) and NerdSip polish ([Nibble](https://nibble-app.com/blog/nerdsip-review)). Questie's 12 challenge types and schema validation are the counter; the fix loop must reject courses that use only MCQ.
- Paywalling generation so hard users cannot try it ([Nibble on NerdSip](https://nibble-app.com/blog/nerdsip-review)). Plan already gives one free course.
- "Vibes-based" prompt tuning ([GrowthBook on Khan](https://blog.growthbook.io/what-i-learned-from-khan-academy-about-a-b-testing-ai/)).

## 2. Credit and usage billing UX

### Comparison

| Product | Unit | Plan + top-up | Rollover / expiry | When empty | Reception |
|---|---|---|---|---|---|
| Cursor | $ of model usage ($20 included on Pro) ([Cursor](https://cursor.com/blog/june-2025-pricing)) | Plan + pay-at-cost overage with a spend limit ([Cursor](https://cursor.com/blog/june-2025-pricing)) | Monthly | Unlimited "Auto" model, or overage up to spend limit ([Cursor](https://cursor.com/blog/june-2025-pricing)) | Switch from requests to compute caused surprise bills; CEO apologized, refunds for Jun 16-Jul 4 2025 ([TechCrunch](https://techcrunch.com/2025/07/07/cursor-apologizes-for-unclear-pricing-changes-that-upset-users/)) |
| Perplexity | Weekly query caps on advanced models | Plan only | Weekly | Blocked on advanced models | Silent cap cuts drew complaints ([Android Authority](https://www.androidauthority.com/perplexity-pro-advanced-ai-limits-reduced-3667942/)); "unlimited" marketing led to a petition ([change.org](https://www.change.org/p/hold-perplexity-accountable-for-unlimited-claims/u/34297364)) |
| ElevenLabs | Credits ([docs](https://elevenlabs.io/docs/help-center/account/general/what-are-credits.md)) | Plan + Pay As You Go top-ups, min $5, auto top-up ([docs](https://elevenlabs.io/docs/overview/administration/pay-as-you-go)) | Plan credits roll over up to 2x quota on the same plan; top-ups expire after 12 months, non-refundable ([rollover](https://help.elevenlabs.io/hc/en-us/articles/27561768104081-How-does-credit-rollover-work), [PAYG](https://elevenlabs.io/docs/overview/administration/pay-as-you-go)) | Paused until top-up ([docs](https://elevenlabs.io/docs/help-center/account/general/what-happens-when-i-run-out-of-credits.md)) | Model widely copied |
| Midjourney | Fast GPU hours ([docs](https://docs.midjourney.com/docs/fast-relax)) | Plan + extra hours at $4/h ([plans](https://docs.midjourney.com/docs/plans)) | Monthly hours do not roll over; bought hours never expire but need an active plan; no refunds ([docs](https://docs.midjourney.com/docs/fast-relax)) | Relax mode: slower, free ([docs](https://docs.midjourney.com/docs/fast-relax)) | Fallback praised as a soft landing ([The Good](https://thegood.com/?p=111861)) |
| Oboe | Courses per month ([TechBriefly](https://techbriefly.com/?p=173747)) | Plan tiers only | Monthly | Rate limit ([Oboe](https://oboe.com/learn/oboe-plan-benefits-explained-1ri2hgs)) | Plain unit, easy to read |

### What users like and hate

- Hate: not knowing what a credit is worth or how fast it burns ([The Good](https://thegood.com/?p=111861), [Metronome](https://metronome.com/blog/the-rise-of-ai-credits-why-cost-plus-credit-models-work-until-they-dont)).
- Hate: unit changes or cap cuts without notice ([Cursor apology](https://techcrunch.com/2025/07/07/cursor-apologizes-for-unclear-pricing-changes-that-upset-users/), [Perplexity](https://www.androidauthority.com/perplexity-pro-advanced-ai-limits-reduced-3667942/)).
- Hate: two currencies to learn ([Product Hunt thread](https://www.producthunt.com/p/vibecoding/is-usage-based-pricing-becoming-the-norm-for-ai-tools)).
- Like: cost shown before the action runs, and a rate table ([Metronome](https://metronome.com/blog/the-rise-of-ai-credits-why-cost-plus-credit-models-work-until-they-dont), [The Good](https://thegood.com/?p=111861)).
- Like: early warning near the limit (Canva) and a degraded mode instead of a wall (Midjourney Relax) ([The Good](https://thegood.com/?p=111861)).
- Like: hard spend caps ([Cursor](https://cursor.com/blog/june-2025-pricing)).

### Borrow

- One currency, integer prices, fixed per action (already in the plan config module). Show the price on the button ("Build course · 100").
- Balance and ledger history on the profile screen; each row names the action.
- Warn once at low balance; 402 response opens the top-up sheet.
- Non-AI features never touch credits, which is Questie's "Relax mode": library, games, katas, SRS stay free.
- Spend order and expiry like Midjourney/ElevenLabs: monthly grant first, then top-ups; top-ups do not expire while the account exists. Monthly rollover is not decided in the plan; ask the owner before adding it.
- Refund as a visible ledger row when a build fails (plan item 5).

### Avoid

- Changing credit costs silently. Announce changes in-app before they apply.
- "Unlimited" in copy.
- Auto top-up at launch: ElevenLabs pauses service when it fails ([docs](https://elevenlabs.io/docs/overview/administration/pay-as-you-go)); not needed for EUR 5.99 packs.

## 3. Better Auth + Hono + SQLite, and Capacitor auth

| Topic | Finding | Source |
|---|---|---|
| Driver | `node:sqlite` supported (Node >= 22.5, no flag since 22.13); better-sqlite3 is the "most stable" option | [Better Auth SQLite adapter](https://better-auth.com/docs/adapters/sqlite) |
| Hono mount | Official example mounts `auth.handler` on `/api/auth/*`; it targets Workers + Drizzle, not Node | [Hono docs](https://hono.dev/examples/better-auth-on-cloudflare) |
| Data dir | SQLite file must sit on a persistent volume | [HonoForge starter](https://codeberg.org/Naabil/HonoForge) |
| Stripe plugin | `createCustomerOnSignUp`, webhook at `/api/auth/stripe/webhook`, handles subscription events | [Better Auth Stripe](https://better-auth.com/docs/plugins/stripe) |
| Capacitor origins | Add `capacitor://localhost` (iOS) and `https://localhost` (Android) to `trustedOrigins` | [Capgo guide](https://capgo.app/blog/how-to-use-better-auth-in-capacitor-apps/) |
| Cookies in WKWebView | Third-party cookies blocked since iOS 14; workaround is `WKAppBoundDomains`, max 10 domains | [Capacitor Cookies](https://capacitorjs.com/docs/apis/cookies) |
| Cookie reports | Server-set cookies not persisting on Capacitor iOS; bearer in Preferences works | [Ionic forum](https://forum.ionicframework.com/t/server-set-cookies-not-working-on-capacitor-ios/224688), [Ionic forum](https://forum.ionicframework.com/t/capacitor-ios-cookie-authentication-capacitor-http/237748/2) |
| Bearer plugin | Token returned in `set-auth-token` header; docs say use only where cookies do not work | [Better Auth bearer](https://better-auth.com/docs/plugins/bearer) |
| CORS gotcha | Must `exposeHeaders: ['set-auth-token']` or the client never sees the token | [Capgo guide](https://capgo.app/blog/how-to-use-better-auth-in-capacitor-apps/) |
| Token storage | Keychain / Keystore, not localStorage | [Capgo guide](https://capgo.app/blog/how-to-use-better-auth-in-capacitor-apps/) |
| Native Google / Apple | Pass the native ID token to `signIn.social`; Google needs online mode; Apple needs `appBundleIdentifier`; trust `https://appleid.apple.com` | [Capgo guide](https://capgo.app/blog/how-to-use-better-auth-in-capacitor-apps/), [Capgo social login](https://capgo.app/docs/plugins/social-login/better-auth/) |
| Reference pattern | Expo client keeps cookies in SecureStore and sends them manually with `credentials: "omit"` | [Better Auth Expo](https://better-auth.com/docs/integrations/expo) |

### Borrow

- Web: cookies (default). Capacitor: bearer plugin, token in secure native storage, `Authorization` header from the API client. One server, both paths.
- Native Google/Apple sign-in via ID token, not an in-WebView OAuth redirect.
- Keep `node:sqlite` (already used) with the adapter; no second driver.
- Better Auth Stripe plugin for customer + subscription state if it fits; the credit ledger stays our own code (see 4).

### Avoid

- Relying on cookies inside the iOS WebView ([Capacitor](https://capacitorjs.com/docs/apis/cookies)).
- Bearer token in localStorage on mobile ([Capgo](https://capgo.app/blog/how-to-use-better-auth-in-capacitor-apps/)).
- Setting `stripeCustomerId` via `updateUser`; recent versions ignore it ([Better Auth changelog](https://better-auth.com/changelog)).

## 4. Stripe Checkout, Stripe Tax, credits ledger, RevenueCat

### Stripe

| Topic | Finding | Source |
|---|---|---|
| Stripe Billing Credits | Credit grants only apply to metered prices with a Billing Meter | [Credit Grant API](https://docs.stripe.com/api/billing/credit-grant), [changelog](https://docs.stripe.com/changelog/acacia/2025-02-24/billing-credits-price-level-applicability) |
| Grant timing | Stripe's credits guide grants on `invoice.paid` | [Billing credits guide](https://docs.stripe.com/billing/subscriptions/usage-based/billing-credits/implementation-guide) |
| Duplicates | Same event can arrive more than once; store processed event IDs | [Webhooks](https://docs.stripe.com/webhooks) |
| Ordering | No order guarantee; do not use `created` to order | [Webhooks](https://docs.stripe.com/webhooks) |
| Fulfillment | Fulfill function may run several times concurrently; check `payment_status`; also call it from the success page; handle `checkout.session.async_payment_succeeded` | [Fulfill orders](https://docs.stripe.com/checkout/fulfillment) |
| Tax on | `automatic_tax[enabled]=true` on the session plus tax code and behavior per price | [Checkout taxes](https://docs.stripe.com/payments/checkout/taxes?payment-ui=checkout-form) |
| Tax behavior | "Automatic" = inclusive for non-USD/CAD; cannot change after set, need a new price | [Tax behavior](https://docs.stripe.com/tax/products-prices-tax-codes-tax-behavior) |
| Registrations | Tax is zero where no registration exists | [Set up Stripe Tax](https://docs.stripe.com/tax/set-up) |
| VAT IDs | Checkout checks format only; validity checked async | [Checkout taxes](https://docs.stripe.com/payments/checkout/taxes?payment-ui=checkout-form) |
| Portal | Cancel on by default; invoices; plan switching off by default | [Configure portal](https://docs.stripe.com/customer-management/configure-portal) |

### RevenueCat

| Topic | Finding | Source |
|---|---|---|
| Consumables | Arrive as `NON_RENEWING_PURCHASE` (sample: a token pack) | [Event types](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields), [samples](https://www.revenuecat.com/docs/integrations/webhooks/sample-events) |
| Refunds | `CANCELLATION` covers refunded non-renewing purchases | [Event types](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields) |
| Auth | Static `Authorization` header set in dashboard; verify on every call | [Webhooks](https://www.revenuecat.com/docs/integrations/webhooks) |
| Retries | At-least-once; retries reuse `event.id`; 5, 10, 20, 40, 80 min | [Hookdeck guide](https://hookdeck.com/webhooks/platforms/guide-to-revenuecat-webhooks-features-and-best-practices) |
| In-App Currency | RevenueCat can hold balances itself, but wants to be the source of truth and does not support merging or transferring balances | [In-App Currency](https://www.revenuecat.com/docs/offerings/virtual-currency), [source of truth](https://www.revenuecat.com/docs/offerings/virtual-currency/faq/balance-source-of-truth) |
| Apple rules | US storefront allows external purchase links since May 2025; IAP still required where it was | [MacRumors](https://www.macrumors.com/2025/05/01/apple-updates-u-s-app-review-guidelines-epic/), [TechCrunch](https://techcrunch.com/2025/05/02/apple-changes-us-app-store-rules-to-let-apps-redirect-users-to-their-own-websites-for-payments) |

### Borrow

- Own ledger, not Stripe Billing Credits (ours are not metered prices) and not RevenueCat In-App Currency (web + mobile must share one balance).
- Ledger shape: append-only rows `(user_id, delta, kind, source, source_id, created_at)` with `UNIQUE(source, source_id)`. Sources: `stripe:<invoice_id>` for monthly grants, `stripe:<checkout_session_id>` for packs, `rc:<event_id>`, `spend:<idempotency_key>`, `refund:<spend_id>`. A duplicate insert is the dedupe, as Stripe suggests ([Webhooks](https://docs.stripe.com/webhooks)).
- Grant monthly credits on `invoice.paid` ([guide](https://docs.stripe.com/billing/subscriptions/usage-based/billing-credits/implementation-guide)); packs on `checkout.session.completed` with `payment_status=paid` or `async_payment_succeeded` ([Fulfill](https://docs.stripe.com/checkout/fulfillment)).
- One `fulfill(sessionId)` used by both webhook and success redirect.
- EUR prices with tax behavior inclusive, so EUR 11.99 is what the user pays ([Tax behavior](https://docs.stripe.com/tax/products-prices-tax-codes-tax-behavior)).
- RevenueCat: verify header, insert `rc:<event.id>`, return 200; `NON_RENEWING_PURCHASE` -> pack grant, `INITIAL_PURCHASE`/`RENEWAL` -> monthly grant, `CANCELLATION` of a pack -> negative row.
- Spend: insert the negative row inside one transaction that checks balance; return 402 if short (RevenueCat's own AI-app example also uses 402: [blog](https://www.revenuecat.com/blog/engineering/how-to-monetize-your-ai-app-with-virtual-currencies)).

### Avoid

- Granting credits from the success page only ([Fulfill](https://docs.stripe.com/checkout/fulfillment)).
- Trusting event order or timestamps ([Webhooks](https://docs.stripe.com/webhooks)).
- Picking tax behavior late; it is locked per price ([Tax behavior](https://docs.stripe.com/tax/products-prices-tax-codes-tax-behavior)).

## 5. Astro Starlight landing + docs

| Site | Notes | Source |
|---|---|---|
| starlight.astro.build | Its own homepage is the reference `template: splash` + `hero` page | [Pages guide](https://starlight.astro.build/guides/pages/) |
| biomejs.dev | Dev tool landing + docs on Starlight | [Wappalyzer](https://www.wappalyzer.com/technologies/documentation/starlight/) |
| v2.tauri.app | Framework landing + guides + reference on Starlight | [Wappalyzer](https://www.wappalyzer.com/technologies/documentation/starlight/) |
| developers.cloudflare.com | Very large docs set on Starlight | [Wappalyzer](https://www.wappalyzer.com/technologies/documentation/starlight/) |
| awesome-starlight | Curated list of sites, themes, plugins | [GitHub](https://github.com/trueberryless-org/awesome-starlight) |

How the landing page is built:

- `template: splash` removes sidebars; `hero` takes `title`, `tagline`, `image` (light/dark pair), `actions` with `variant` and `icon` ([Frontmatter](https://starlight.astro.build/reference/frontmatter/)).
- Component overrides replace the Hero or other parts when frontmatter is not enough ([Overrides](https://starlight.astro.build/reference/overrides/)).
- Plugins exist for showcase pages and grouped index pages ([Plugins](https://starlight.astro.build/resources/plugins)).

### Borrow

- One Starlight site in `site/`: `index.mdx` on splash with hero (mascot image, light/dark), pricing as a splash page, docs as normal pages.
- Override only the Hero if needed; keep the rest stock.

### Avoid

- A separate landing app outside Starlight (two builds, two styles).

## 6. Litestream with SQLite on Fly or a VPS

| Topic | Finding | Source |
|---|---|---|
| Single container | Run app under Litestream's process supervision (`replicate -exec`) | [Litestream Docker](https://litestream.io/guides/docker/) |
| Boot order | Restore if missing -> migrate -> replicate; recover by deleting machine + volume and redeploying | [Fly SQLite](https://fly.io/docs/js/prisma/sqlite/) |
| Restore flags | `-if-db-not-exists` avoids overwriting; `-if-replica-exists` lets the first deploy start empty | [ServiceStack](https://docs.servicestack.net/ormlite/litestream) |
| Storage | Fly examples use Tigris (S3-compatible) | [Fly SQLite](https://fly.io/docs/js/prisma/sqlite/) |
| v0.5 | LTX files with TXIDs and checksums; restore reads v0.3 backups | [Fly blog](https://fly.io/blog/litestream-v050-is-here/), [Migration](https://litestream.io/docs/migration/) |
| App settings | WAL mode, `busy_timeout = 5000`; Litestream owns checkpoints; set `wal_autocheckpoint = 0` under heavy writes | [Tips](https://litestream.io/tips/) |
| VPS | Run as systemd service next to the app | [systemd guide](https://litestream.io/guides/systemd/) |
| Cost | Example backup bill of $0.03/month | [mtlynch](https://mtlynch.io/litestream/) |

### Borrow

- Entrypoint: `litestream restore -if-db-not-exists -if-replica-exists $DB && litestream replicate -exec "node server"`.
- Set `journal_mode=WAL` and `busy_timeout=5000` where `openDb` opens the database.
- Same image for Fly and VPS compose; only the replica URL and keys differ.
- Docs page: backup, point-in-time restore, and the delete-volume-and-redeploy drill.

### Avoid

- More than one machine writing the same DB; Litestream is single-writer (implied by the one-volume Fly pattern: [Fly SQLite](https://fly.io/docs/js/prisma/sqlite/)).
- App-side `wal_checkpoint(TRUNCATE)` calls ([Tips](https://litestream.io/tips/)).

## Open questions for the owner

- Do unused monthly credits roll over (ElevenLabs caps at 2x) or reset (Midjourney)? Not set in the plan.
- Use the Better Auth Stripe plugin for subscription state, or own Stripe webhook code for everything?
