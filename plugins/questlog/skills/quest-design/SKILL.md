---
name: quest-design
description: Designs gamified learning quests on any topic (courses split into levels of short theory cards followed by challenges), grounded in learning science. Covers learning objectives, level structure, theory cards with step-through code traces and request flows, the challenge mix (quiz, ordering, bug-spotting, written self-explanation, coding katas), item-writing rules, gamification that helps rather than hurts, hallucination guards and a final self-review. Use when asked to "design a course", "make a quest", "teach me X as a game", "turn my notes into a course", "write quiz questions", "write challenges or flashcards", "gamify learning", or before writing content for any learning platform, including Questlog.
---

# Quest design

A quest is a course split into **levels**. Each level is a short run of **theory cards** followed by **challenges**. The learner earns XP, keeps a combo going, has a few lives per level, and everything they answer feeds a spaced-repetition review queue. Your job is to make that loop teach.

This skill is platform-agnostic. For Questlog file formats, use the `questlog-course` skill after this one.

## Workflow

1. **Scope.** Ask (or infer) who the learner is, what they already know, what they need to do afterwards, and which sources are authoritative (their notes, a repo, a spec). Personal notes beat general knowledge.
2. **Objectives.** Write 3–6 objectives per level as *"After this level the learner can <observable verb> <thing>"*: explain, predict, choose, order, spot, write, compute. Never "understand" or "know about".
3. **Level map.** Group objectives into levels, order levels by dependency, end with a boss level.
4. **Cards.** Write the theory for each level (rules below).
5. **Challenges.** Write challenges that each test one objective; every objective gets at least two challenges of different types.
6. **Verify.** Run every code sample. Check every factual claim against a source. Mark what you could not verify.
7. **Self-review.** Run [references/item-checklist.md](references/item-checklist.md) over every item, then fix.

For a course of more than ~3 levels, show the user the objectives and level list before writing the rest.

## Levels

- **One level = one cohesive idea cluster** a learner can hold in their head at once: "status codes and caching", not "HTTP part 2".
- **4–8 theory cards, 5–10 challenges.** Fewer cards than that usually means the level is too thin to deserve its own node; more means split it.
- **Order by dependency**: a level may only test what it or an earlier level taught.
- **Boss level last.** It mixes material from every earlier level (interleaving), leans on written answers and katas, and asks the learner to combine ideas ("walk through the whole request"). A boss level can have its own short theory that ties things together.
- **One consistent sample world per level**, ideally per course: the same user, the same ids, the same URLs and numbers across cards, traces, flows and challenges. The learner spends attention on the idea, not on re-parsing new data.

## Theory cards

- **One idea per card.** The title names the idea ("Cache-Control says how long", not "Caching 2").
- **Show, don't tell.** Lead with a concrete artifact (a request, a snippet, a diagram), then 2–5 sentences or bullets on what to notice. Cut every sentence the learner would not miss.
- **Pick the block by what the idea is:**
  - Code runs and values change over time → a **step-through trace**: highlight the line about to run, show only the variables that change, add a note on the steps that matter. Use real sample values, including the interesting branch (the retry, the cache miss, the edge case).
  - A request or message moves between parts of a system → a **flow**: name the actors, one hop per step, the real payload on each hop (headers, JSON, SQL), a note where something surprising happens.
  - Structure, states or decisions → a **diagram** (sequence, flowchart, state).
  - A static excerpt to read → a **code block** with the 1–3 key lines highlighted.
  - A mood or landmark for the level → a small illustration, never as the only carrier of information.
- **Keep code short**: 5–20 lines, real, runnable or a real excerpt, and narrow enough for a phone (about 40 characters per line). Elide with a comment, never with invented APIs.
- **Prefer contrast**: the wrong way and the right way side by side teaches the boundary of an idea.
- **End a level's theory on the thing the challenges ask about.** Nothing in a challenge may depend on knowledge the cards never gave and the learner did not bring.

## The challenge mix

Retrieval practice (testing yourself) and spaced practice are the two techniques rated *high utility* across ages, materials and outcomes (Dunlosky et al., 2013); interleaving and self-explanation are rated moderate. Every challenge is retrieval practice; the platform's review queue supplies the spacing. Choose the type by what the objective asks the learner to do:

| Type | Trains | Use for | Per level |
|---|---|---|---|
| Quiz (MCQ) | Recognition and discrimination | Telling similar concepts apart, predicting an outcome, choosing a tool | 2–5 |
| Order | Sequence knowledge | Processes, lifecycles, algorithms, protocol handshakes | 0–1 |
| Bug | Code reading | Spotting the one line that breaks a rule the level taught | 1–2 |
| Written | Recall + self-explanation | "Explain why", "walk me through", trade-offs; graded against key points | 1–3 |
| Kata | Procedural skill | Writing a small function with tests | 0–2 |

Rules of thumb:

- **Mix types inside a level** and put an easy win first.
- **Prefer recall over recognition** when the objective is to produce something: a written answer or kata beats a quiz.
- **Every miss feeds review.** The point of a wrong answer is to schedule it again soon, not to punish.
- **Interleave in the boss**: questions that require choosing *which* idea applies are harder and stick better than blocks of the same kind.
- **Explanations after answering** say why the right answer is right *and* why the tempting wrong one is wrong, in 1–3 sentences.

Per-type guidance, templates and examples: [references/challenge-types.md](references/challenge-types.md).

## Item-writing rules

Andy Matuschak's five properties of a good retrieval prompt apply to every challenge:

- **Focused**: one detail or one idea per item.
- **Precise**: the question admits one answer; vague questions get vague answers.
- **Consistent**: the same answer every time it comes back in review.
- **Tractable**: a learner who studied can almost always get it right.
- **Effortful**: the answer must come from memory, not from cues in the question.

Multiple-choice flaws to avoid (Haladyna, Downing & Rodriguez, 2002):

- No "all of the above" or "none of the above".
- The right answer must not be the longest, most qualified or most technical option. Make options similar in length and style.
- No implausible distractors. Each wrong option is a **real misconception**: the thing a learner who half-understood would pick.
- Exactly one defensible answer. If an expert could argue for two, rewrite. Test each distractor against the source literally, including its "MAY" clauses and edge cases: "the server never receives the scheme" is also true of an HTTP/1.1 request line; "404 to hide a forbidden page" is allowed by the spec.
- No grammar or wording cues ("an" before the only vowel option, the stem's keyword repeated in only one option).
- No negatives in the stem unless the negative is the point, and then bold it: "Which method is **not** idempotent?"
- 3–4 options. A fifth weak option adds nothing.

## Gamification that helps

Use game mechanics as **feedback about learning**, never as the goal. Rewards that feel controlling or are expected for merely doing a task undermine intrinsic motivation (Deci, Koestner & Ryan, 1999); informational feedback does not.

Helps:
- **XP as a progress readout**: more for harder types, little for replays, so it measures learning, not grinding.
- **Combo multiplier** for consecutive correct answers: rewards sustained attention within a session.
- **Lives** (e.g. 3 per level) make a level a real challenge. Losing a life must also schedule the item for review, so failure produces practice.
- **Stars per level** (lives left) as mastery feedback that invites a retry.
- **Ranks** as milestones over total XP.
- **A review queue** that brings missed items back first.

Hurts (do not add):
- Leaderboards and social comparison in a personal learning tool.
- Currencies, shops, loot boxes, or anything spendable that becomes the goal.
- Punishing a broken daily streak. If there is a streak, give it slack (freezes, repair); Duolingo's own experiments found flexibility kept more learners active.
- Timers on everything. Use a soft time limit only where fluency is the objective (interview answers, mental arithmetic).

Background and sources: [references/pedagogy.md](references/pedagogy.md).

## Hallucination guards

A course teaches whatever it says, so a wrong fact becomes a wrong memory that the review queue reinforces.

- **Use the learner's own material first.** When they gave notes, a repo or docs, quote them and keep their terminology. Do not "improve" their facts silently; flag disagreements.
- **Cite.** Put the source (spec section, doc page, file path) in the card text or the challenge explanation for every non-obvious claim.
- **Never invent APIs, flags, config keys, versions or numbers.** If you cannot confirm one, leave it out or say it is unverified.
- **Mark uncertainty** in the content ("as of 2026", "in Chrome; other browsers differ") and tell the user what you could not check.
- **Run the code.** Every snippet, trace and kata solution must run and produce the values you show. Compute trace values by executing, not by imagining.
- **Excerpts are excerpts.** When teaching a real codebase, copy real lines; never paraphrase code into something that looks real.

## Final self-review

Before handing over, check:

- [ ] Every level has objectives, 4–8 cards and 5–10 challenges; a boss level closes the course.
- [ ] Every objective has ≥2 challenges of different types; every challenge maps to an objective the cards taught.
- [ ] Sample data is consistent within each level.
- [ ] Every trace and flow uses real values that you computed or copied.
- [ ] Every item passes [references/item-checklist.md](references/item-checklist.md): one right answer, real-misconception distractors, no length or grammar cues, explanation present.
- [ ] Written challenges have a model answer and 2–5 checkable key points.
- [ ] Katas have a statement with edge cases spelled out, visible and hidden tests, a starter that fails and a solution that passes.
- [ ] Every factual claim is sourced or marked; nothing was invented.
- [ ] Gamification only reports learning; nothing punishes beyond scheduling review.
