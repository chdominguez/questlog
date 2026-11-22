# Questie: what learners and developers say

Research date: 2026-11-22. Input for the plan in `questie-plan.md`.

## Method

- Reddit: r/Anki, r/duolingo, r/GetStudying, r/learnprogramming, r/SaaS, read through the Arctic Shift archive API (reddit.com blocks direct search). One query returns at most 100 posts, so counts are lower bounds.
- Hacker News: Algolia search API. Its hit counts use fuzzy matching, so treat them as rough.
- App reviews: read through review-analysis blogs, not app stores directly. Press and blog posts where no forum thread exists.
- Each item is tagged **Fact** (an event, a rule, a price, a feature) or **Opinion** (what users say). Scores are upvotes or HN points at fetch time.

Frequency scale:

| Level | Meaning |
|---|---|
| High | 5+ distinct threads, several over 100 points, or a mod rule or company response |
| Medium | 2-4 threads, or one thread over 100 points |
| Low | One source, or threads under 50 points |

## 1. Top pains

| # | Pain | Freq | Type | Evidence |
|---|---|---|---|---|
| 1 | AI-made study material is distrusted by default | High | Fact + Opinion | r/Anki added Rule 6 "No low-effort AI content" ([168](https://redd.it/1ray0h6)). "Nobody wants to use your AI card creator" ([625, 70 comments](https://redd.it/1ws2ih0)). Top reply in a builder's thread: checking AI cards against the source "wouldn't take much longer than making a card" ([Janus thread](https://redd.it/1pc8ya7)). |
| 2 | Making the material yourself is seen as the learning | High (r/Anki) | Opinion | Top comment (195) in the [AI card creator thread](https://redd.it/1ws2ih0): peers who use AI cards "have to see the card more times to learn it". Repeated in mod-adjacent replies in the same thread. |
| 3 | Gamification that serves retention, not learning | High | Opinion | Duolingo "Energy" called "blatant behavioral coercion" ([167](https://redd.it/1vpwzs2)), "I HATE ENERGY" ([164](https://redd.it/1sdo9sm)), "How much scummier can this app get?" ([161](https://redd.it/1uec47q)), "Breakup letter to Duo" ([424](https://redd.it/1xz9pvl)). HN: "10+ pop-ups after a lesson" ([459-point thread](https://news.ycombinator.com/item?id=44100035)). Unstar ranks "gamification over learning" first among education-app complaints ([vendor, no method](https://unstar.app/blog/education-learning-app-reviews-what-students-teachers-complain-about-2026)). |
| 4 | Paywalls that lock you out of practice after mistakes | High | Fact + Opinion | Duolingo energy plus ads cap plus gems ([167](https://redd.it/1vpwzs2)); top reply: "legendary lessons are straight up unusable without super" (73). Gizmo free tier caps hearts and imports; Unlimited about $13.99/week or $155/year ([Techraisal](https://www.techraisal.com/blog/gizmo-ai-vs-knowt-i-used-both-for-a-full-semester-and-who-actually-wins-in-2026), [Adapty paywall library](https://adapty.io/paywall-library/gizmo/)). Unstar claims ~30% of negative reviews are about subscriptions (unverified). |
| 5 | Apps feel like progress but don't transfer to real skill | Medium | Opinion | "I finally quit Duolingo after 3 years. Now I'm learning to actually speak" ([417](https://redd.it/1tkymr5)). HN: "Number of people I know that used Duolingo successfully to be fluent: 0" ([thread](https://news.ycombinator.com/item?id=43827978)). Brilliant: "for learning-learning? No ... info-tainment" ([Ask HN](https://news.ycombinator.com/item?id=29881011)). |
| 6 | Course rebuilds and redesigns wreck progress | Medium | Fact + Opinion | Duolingo announced overhauls of its biggest courses ([1,085 points, 329 comments](https://redd.it/1r2eiwz)); replies ask for "(old)" and "(new)" course versions side by side. Unstar lists "redesigns breaking progress" and "progress loss and sync failures". |
| 7 | "Why not just ask a chatbot?" | Medium | Opinion | Oboe launch: "how is it different from prompting another AI chatbot to make a step by step course?" ([Product Hunt](https://www.producthunt.com/products/oboe-2/reviews)). HN on Duolingo: "If the CEO thinks AI will teach me a language then I'll use a low cost LLM" ([459-point thread](https://news.ycombinator.com/item?id=44100035)). |
| 8 | Learning to code while AI writes the code | Medium | Opinion | Teacher asks how to run a C course "in the AI age" ([202, 168 comments](https://redd.it/1vp22b7)); replies favour paper exams and defending your own project. "How do you search complex topics without AI?" ([43, 83 comments](https://redd.it/1y06uet)); top replies: depth takes time, layer by layer. |
| 9 | Notification guilt | Medium | Opinion | "Can Duolingo stop sending me 'Perfect Streak at risk' early in the morning?" ([84](https://redd.it/1xsrunm)). Unstar lists "notification spam and guilt-tripping". |
| 10 | Too many study tools | Low | Opinion | "Anyone else trying way too many study tools?" ([37](https://redd.it/1q78cnx)). |

## 2. Most-wanted capabilities

| Capability | Freq | Type | Evidence |
|---|---|---|---|
| Cards and questions traceable to a source, so accuracy can be checked | Medium | Opinion | Janus thread top question ([link](https://redd.it/1pc8ya7)); builder's answer: cards are "always generated from source material". HN on an AI course site: "What stops it hallucinating videos that don't exist?" ([link](https://news.ycombinator.com/item?id=41427247)). |
| Real spaced repetition behind generated cards | Medium | Fact | NotebookLM flashcards track "Got it / Missed it" per session with no interval scheduling ([StudyCards comparison, vendor](https://studycardsai.com/vs/notebooklm-vs-studycards)); a Chrome extension exists only to move NotebookLM cards into Anki ([Study Cycle Bridge](https://chromewebstore.google.com/detail/study-cycle-bridge-notebo/hibpfanlbdndbmicmlkddjchcbccolho?hl=en)). |
| Export / no lock-in | Medium | Fact | NotebookLM has no documented export; third-party exporters fill the gap ([NLM Tools](https://www.nlmtools.com/blog/notebooklm-export-quiz)). Self-hosters ask for an "escape button" to export data and self-host ([OpenNMS on AGPL and CLAs](https://www.adventuresinoss.com/agpl-and-clas/)). |
| Clear pricing and license up front | High (r/Anki) | Fact | r/Anki Rule 3 now requires posts to state pricing and license; a top reply calls out "bait-and-switch tactics" ([168](https://redd.it/1ray0h6)). |
| Practice not gated by lives or energy | High | Opinion | See pain 4. Brilliant is praised on HN for not pushing gamification: "it's not in your face like Duo" ([link](https://news.ycombinator.com/item?id=29881011)). |
| Honest streaks, with forgiveness for real life | Medium | Opinion | Two sides: "Lost my streak because I was sick for one day. Now I have zero motivation" (Unstar quote) and "Duolingo is giving out artificial streak freezes to boost retention" ([110](https://redd.it/1vsrque)). |
| Level-appropriate content, not one size | Medium | Opinion | Unstar complaint category 4 "one-size content that ignores skill level". Duolingo: "multiple answers for a single prompt makes no sense" ([101](https://redd.it/1w8hyug)). |
| Feedback on each answer, not just a reveal | Low | Fact | NotebookLM flashcards have no way to mark a card right or wrong ([Yahoo Tech](https://tech.yahoo.com/ai/articles/notebooklm-quizzes-way-more-helpful-113358599.html)); its newer quiz explains wrong answers ([TechRadar](https://www.techradar.com/ai-platforms-assistants/gemini/i-started-using-notebooklms-new-quiz-tools-and-theyre-actually-great-for-learning)). |
| Accessibility | Low-Medium | Opinion | "Duolingo Routinely Excludes Blind People" ([245](https://redd.it/1t0fz8d)). |
| Offline mode and reliable sync | Low | Opinion | Unstar categories "broken offline mode", "progress loss and sync failures". |

## 3. Complaints about existing tools

| Tool | Accuracy | Shallow quizzes | Paywall | Streak manipulation |
|---|---|---|---|---|
| Duolingo | AI stories "formulaic" ([45](https://redd.it/1txrl4h)), "what happened to the stories" ([165](https://redd.it/1mti7rd)), "AI doesn't understand context" ([34](https://redd.it/1ptecgx)). Users cancelled Super over replacing human writers ([HN 459](https://news.ycombinator.com/item?id=44100035)). Freq: High | Weak at production/speaking ([417](https://redd.it/1tkymr5)). Freq: Medium | Energy system, Legendary needs Super ([167](https://redd.it/1vpwzs2), [117](https://redd.it/1s1lnmz)). Freq: High | Free or "gifted" freezes keep streaks alive; a 562-day streak revived after a family-plan invite ("Did Duolingo just perfectly manipulate me", [227](https://redd.it/1ttp9f0)); a commenter tried to kill a streak and found it "SO HARD to kill" ([110](https://redd.it/1vsrque)). Freq: Medium |
| NotebookLM | No HN or Reddit threads found on wrong answers in study tools. Freq: Low | No SRS, no export, no right/wrong marking on cards (section 2). Freq: Medium | Trustpilot complaints are about usage caps and Gemini-only models ([Zemith, competitor](https://www.zemith.com/en/learn/notebooklm-review.md)). Freq: Low | Not applicable |
| Oboe | Launch reviewers asked whether depth holds on fringe topics ([TechRadar](https://www.techradar.com/ai-platforms-assistants/gemini/oboe-just-launched-its-an-ai-powered-platform-that-helps-you-learn-anything)); "lack of a single, consistent voice" ([AI Indigo](https://aiindigo.com/blog/personalized-learning-that-actually-works-an-honest-review-of-oboe-in-2026)). Short prompts give unpredictable courses; "hi" produced a course on first impressions ([Product Hunt](https://www.producthunt.com/products/oboe-2/reviews)). Freq: Low | No complaints found; Tom's Guide liked the quizzes. Freq: Low | None found | None found |
| Brilliant | None found | "Seems a bit surface-level" on logic courses ([HN](https://news.ycombinator.com/item?id=28501947)). Freq: Low | Charged after cancelling ([Ask HN](https://news.ycombinator.com/item?id=25493065)). Freq: Low | Praised for not pushing streaks |
| Gizmo | None found | Flashcards/MCQ only | Hearts and import limits as soft paywall; weekly plan ([screensdesign](https://screensdesign.com/showcase/gizmo-ai-flashcards)). Freq: Medium | Lives lock you out after wrong answers |
| AI card generators (Anki ecosystem) | Accuracy check costs as much as writing the card ([Janus thread](https://redd.it/1pc8ya7)). Freq: High in r/Anki | "Basically just an AI prompt" with an upload button ([Rule 6 thread](https://redd.it/1ray0h6)). Freq: High | Unclear pricing led to Rule 3 | Not applicable |

Facts worth knowing:
- Duolingo's "AI-first" memo and contractor cuts drew the 459-point HN thread and coverage in [Fast Company](https://www.fastcompany.com/91338068); the company disputes that layoffs took place.
- Unstar says review complaints in language apps moved from "not enough content" to "bad AI content". Unstar sells review analysis and gives no sample size ([page](https://unstar.app/blog/language-learning-app-reviews-duolingo-babbel-rosetta-stone-2026)).
- No HN discussion of Oboe exists beyond a [2-point submission](https://news.ycombinator.com/item?id=45210607) with no comments.

## 4. Credit-based pricing in AI apps

| Item | Freq | Type | Evidence |
|---|---|---|---|
| Cursor switched Pro from 500 requests to a $20 usage pool, apologised and refunded unexpected usage from June 16 to July 4 2025, then added spend limits | High | Fact | [TechCrunch](https://techcrunch.com/2025/07/07/cursor-apologizes-for-unclear-pricing-changes-that-upset-users/), [Cursor forum megathread](https://forum.cursor.com/t/pricing-megathread-and-q-a/116395), [HackerNoon](https://hackernoon.com/cursors-credit-based-plans-leave-developers-puzzled-frustrated) |
| The anger was about unclear rules and surprise costs, less about the price | High | Opinion | Same sources; Cursor's CEO said "communication failed" |
| "Credits are usage-based pricing with better lighting"; prepaid credits are "breakage with an expiry date" | Medium | Opinion | [r/SaaS](https://redd.it/1ub569v) |
| Abstract credits are a "big red flag" | Low | Opinion | [HN comment](https://news.ycombinator.com/item?id=50147173); a founder avoided credits because of "the cognitive load" ([HN](https://news.ycombinator.com/item?id=47173707)) |
| Users saw the same task cost very different amounts, and caps moved (Google Antigravity) | Low | Fact (second-hand) | [Zuora essay](https://www.zuora.com/subscribed/when-the-cash-register-is-a-slot-machine/), citing The Register |
| Vendor advice: show the credit cost before and after each action | Low | Opinion (vendor) | [HubSpot buyer's guide](https://blog.hubspot.com/website/ai-credits-buyers-guide), [Chargebee](https://www.chargebee.com/resources/pricing-labs/prepaid-credit-pricing-guide/) |
| "Credit-based pricing sucks and users hate it" | Low | Opinion (billing vendor) | [Lago blog](https://www.getlago.com/blog/credit-based-billing) |
| Concurrent requests can both pass a balance check and overspend; fix is reserve-then-settle with an idempotency key | Low | Fact (engineering) | [r/SaaS](https://redd.it/1xy21cx) |

## 5. AGPL and open core

| Item | Freq | Type | Evidence |
|---|---|---|---|
| "AGPL is a non-starter for most companies" | Medium | Opinion (open-core VC) | [OCV article, HN 39 points, 119 comments](https://news.ycombinator.com/item?id=37903520). Most top replies call it FUD and link Drew DeVault's "[falsehoods of anti-AGPL propaganda](https://drewdevault.com/2020/07/27/Anti-AGPL-propaganda.html)". |
| A seller of AGPL software says customers "wouldn't have even considered paying for a non-free solution" | Low | Opinion | [Same HN thread](https://news.ycombinator.com/item?id=37903520) |
| CLAs are what make relicensing ("rug pulls") possible; DCO projects are trusted more | Medium | Opinion | LWN "Rug pulls, forks, and open-source feudalism": "Projects with CLAs more commonly are subject to rug pulls" ([HN discussion](https://hn.svelte.dev/item/45146967)), [Keygen (fair-source vendor)](https://keygen.sh/blog/weaponized-open-source/) |
| Open-source companies going proprietary is a documented pattern | High | Fact | [TechCrunch timeline](https://techcrunch.com/2024/12/15/open-source-companies-that-go-proprietary-a-timeline) |
| Self-hosters want to run without the vendor's service and export data | Medium | Opinion | [Cloudron forum](https://forum.cloudron.io/topic/1983/cloudron-no-longer-agpl/3), [OpenNMS](https://www.adventuresinoss.com/agpl-and-clas/) |
| Common split: copyleft server, permissive SDK/format | Low | Fact (one project) | [dev.to: AGPL to Apache 2.0](https://dev.to/tsabary/from-agpl-30-to-apache-20-why-ive-changed-the-license-on-90-of-my-project-4jfo) |
| r/Anki requires pricing and license in project posts | High (for launch) | Fact | [Rule update](https://redd.it/1ray0h6) |

## 6. Gotchas for Questie

Each maps to a plan item. None changes a decision in the plan.

1. **"AI course" reads as a negative in the target communities** (pains 1, 2). Lead launch posts with what a chatbot can't do: FSRS review, graded written answers, runnable katas, schema-validated courses. r/Anki bans low-effort AI posts and requires pricing and license in the post.
2. **Accuracy is the first question.** Web-research courses with citations answer it; topic-only courses have no source to check. Show citations in the lesson, and let users edit or flag a generated card or question.
3. **Short prompts give random courses** (Oboe "hi" example). The topic + level input should reject or expand one-word topics before spending 100 credits.
4. **Never put practice behind credits or lives.** The plan meters only AI calls; keep it that way. Energy and hearts are the most upvoted complaint in r/duolingo.
5. **Streaks: no silent freezes, no guilt pushes.** Users notice fake freezes and resent "streak at risk" messages. Repair rules should be visible and the same for everyone.
6. **Show the credit cost before every metered action** and the balance after. Cursor's backlash came from surprise costs, not the price.
7. **Credit expiry is the open point.** The plan grants 1,000 credits/month but does not say whether unused credits roll over or whether top-ups expire. "Breakage with an expiry date" is the main credit complaint. Needs an owner decision.
8. **Two requests can spend the same balance.** Reserve credits before the AI call, settle after, refund on failure, with one idempotency key per request.
9. **Regenerating or updating a course must not wipe progress.** Duolingo's rebuild thread is the highest-scoring post found (1,085). Keep progress keyed to stable ids across course versions.
10. **AGPL with one copyright holder needs a contribution policy.** The plan relies on the owner holding copyright. Taking code PRs under a CLA keeps that but draws rug-pull distrust; DCO keeps trust but ends sole ownership. Course PRs (CC-BY) and format PRs (MIT) are not affected. Needs an owner decision before CONTRIBUTING.md.
11. **Self-host must work without our servers** and export everything. Self-hosters check for this first.
12. **Accessibility** gets public posts when it fails (245 points for Duolingo and blind users). Games and timed challenges need a screen-reader path or a skip.

## Gaps

- reddit.com blocks the search tool; Reddit data came from the Arctic Shift archive, which rate-limited after about 30 requests. Full-text search on some subs returned nothing; title search was used instead.
- No app-store reviews were read directly. Review figures come from Unstar, which sells review analysis and publishes no method.
- No community discussion of Learn Your Way, NerdSip or Morso was found.
