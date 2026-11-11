# Pedagogy behind quest design

Why the rules in SKILL.md exist, with sources. Read this when you need to justify a design choice to the user or decide an edge case.

## Contents

- Retrieval practice and spacing
- Interleaving and self-explanation
- What does not work
- Spaced repetition scheduling (FSRS)
- Writing prompts that work in review
- Multiple-choice item quality
- Rewards, motivation and gamification
- Streaks
- Sources

## Retrieval practice and spacing

Dunlosky et al. (2013) reviewed ten common learning techniques against four criteria (learners, materials, outcome measures, learning conditions). Only two were rated **high utility**:

- **Practice testing**: retrieving information from memory (quizzes, flashcards, explaining from memory). Testing is not just measurement; the act of retrieval strengthens the memory.
- **Distributed practice**: spreading practice of the same material over time instead of massing it.

Design consequences:
- Every challenge is a retrieval event. Prefer more, smaller challenges over long theory.
- Theory is short and immediately followed by questions on it.
- Missed and seen items return on a schedule (the review queue), which supplies the spacing.

## Interleaving and self-explanation

Rated **moderate utility** by Dunlosky et al. (2013):

- **Interleaved practice**: mixing problem types so the learner has to choose the approach, not just execute it. Strongest evidence in math and category learning. Applied here: the boss level mixes topics from every level; the review queue mixes items from all levels.
- **Self-explanation**: explaining how new information relates to what you know, or explaining steps of a solution. Applied here: written challenges ("explain why", "walk me through"), graded against key points.
- **Elaborative interrogation**: generating an explanation for why a stated fact is true. Applied here: "why" questions and explanations that give the reason, not just the answer.

## What does not work

Rated **low utility** by Dunlosky et al. (2013): summarization, highlighting/underlining, the keyword mnemonic, imagery for text learning, and rereading. A quest that is mostly reading cards is a reread. Keep cards lean and move to retrieval fast.

## Spaced repetition scheduling (FSRS)

FSRS (Free Spaced Repetition Scheduler) models each item's memory with stability and difficulty and schedules the next review for a target probability of recall. It is open source and ships in Anki (since 23.10) as an optional scheduler; Questlog uses it through `ts-fsrs`. The open-spaced-repetition srs-benchmark compares schedulers on prediction of recall over review logs from about 10,000 Anki users, using log loss, RMSE and AUC; FSRS variants are among the strongest non-neural models there.

Design consequences:
- Grade each answer as Again / Hard / Good (wrong / partial / right). A miss should come back soon.
- An item must be **consistent** (same answer each time) or the scheduler's model is meaningless.
- Items are reviewed out of context, weeks later. Each must stand alone: no "as shown above".

## Writing prompts that work in review

Andy Matuschak, *How to write good prompts*: retrieval prompts should be **focused** (one detail), **precise** (unambiguous about what to recall), **consistent** (same answer every time), **tractable** (you can almost always answer correctly; break hard things down) and **effortful** (requires actual retrieval; the answer is not given away by cues). He also recommends many small prompts over one big one, and prompts that ask for explanations, examples and implications, not only facts.

## Multiple-choice item quality

Haladyna, Downing & Rodriguez (2002) consolidated textbook and research guidance into 31 item-writing guidelines. The ones that matter most here:

- Options plausible, homogeneous in content and grammar, and similar in length.
- Distractors based on typical errors of learners.
- Avoid "all of the above"; avoid "none of the above".
- Avoid clues: grammatical inconsistency, the longest option being right, words repeated from the stem.
- Word the stem positively; if a negative is required, emphasize it.
- Three options are often enough; extra weak distractors add nothing.

## Rewards, motivation and gamification

Deci, Koestner & Ryan (1999) meta-analyzed 128 experiments: tangible rewards that are expected and contingent on doing, completing or performing a task reduced free-choice intrinsic motivation; verbal, informational feedback tended to increase it. The effect is debated (Cameron and Pierce argue rewards are usually not harmful), but the safe design is clear:

- Make XP, stars and ranks **informational**: they report progress and mastery.
- Do not make rewards **controlling**: no currencies to spend, no rewards that pay for doing a task regardless of learning, no social comparison.
- Replays give little XP so the number tracks learning rather than grinding.
- Lives turn a level into a challenge, but a miss must produce practice (review), not only loss.

## Streaks

Duolingo reports, from its own experiments, that learners who reach a 7-day streak are 3.6 times more likely to complete their course, and that letting learners equip two Streak Freezes instead of one increased daily active learners by 0.38% without making them take more days off. The lesson for design: a streak is a strong habit cue, and **slack** (freezes, repair) keeps more people going than strict punishment. Questlog's in-level combo is different: it multiplies XP for consecutive correct answers and resets on a miss without any other penalty.

## Sources

- Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013). Improving students' learning with effective learning techniques. *Psychological Science in the Public Interest*, 14(1), 4–58. https://doi.org/10.1177/1529100612453266
- Open Spaced Repetition. FSRS algorithm: https://github.com/open-spaced-repetition/fsrs4anki · srs-benchmark: https://github.com/open-spaced-repetition/srs-benchmark
- Matuschak, A. (2020). How to write good prompts: using spaced repetition to create understanding. https://andymatuschak.org/prompts/
- Haladyna, T. M., Downing, S. M., & Rodriguez, M. C. (2002). A review of multiple-choice item-writing guidelines for classroom assessment. *Applied Measurement in Education*, 15(3), 309–333.
- Deci, E. L., Koestner, R., & Ryan, R. M. (1999). A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation. *Psychological Bulletin*, 125(6), 627–668. https://doi.org/10.1037/0033-2909.125.6.627
- Duolingo (2023). How Duolingo's streak builds habit. https://blog.duolingo.com/how-duolingo-streak-builds-habit/
