# Self-review checklist

Run this over the whole course before handing it over. Fix every "no". Do it as a separate critic pass: reread each item cold, as a learner seeing it weeks later in review.

## Every item

- [ ] Tests one idea that a theory card taught (or the learner is known to bring).
- [ ] Stands alone: makes sense in review, out of the level, weeks later. No "as above", no "the previous question".
- [ ] Has exactly one defensible answer. An expert could not argue for a second. Each wrong option was checked against the source, including its permissive ("MAY") clauses.
- [ ] Is precise: the learner knows what kind of answer is wanted.
- [ ] Requires retrieval: the answer is not visible in the stem, the code, or the other options.
- [ ] Has an explanation that says why the right answer is right and why the tempting wrong answer is wrong.
- [ ] Uses the level's sample data (same names, ids, URLs, numbers).
- [ ] Every fact in it is correct and sourced, or the user was told it is unverified.

## Quiz

- [ ] 3–4 options; right answer authored first if the platform shuffles.
- [ ] Every distractor is a named misconception.
- [ ] No "all/none of the above".
- [ ] Right option is not the longest or most qualified. Lengths are within ~30% of each other.
- [ ] No grammar cues (articles, plurals, tense) and no stem keyword echoed only in the right option.
- [ ] Negative stems are avoided or **bold**.

## Multi and true/false

- [ ] At least one option is wrong; the right set is unambiguous.
- [ ] Prompt does not reveal how many are right.
- [ ] True/false statements target a real misconception; not every answer is the same value.
- [ ] Explanation covers each right option and the tempting wrong one.

## Match

- [ ] 3–8 pairs; lefts unique, rights unique, all rights the same kind and length.
- [ ] Each right fits exactly one left.

## Cloze

- [ ] Markers `{{1}}..{{N}}` match the blanks; 1–3 blanks.
- [ ] Each blank has one right term; accepted variants are listed in `answers`.
- [ ] With a bank, the first answers are in it and decoys are plausible; `exact` only where case matters.
- [ ] The text does not give the blank away.

## Sort

- [ ] 2–4 buckets with mutually exclusive labels; each has items.
- [ ] Every item belongs to exactly one bucket, no argument needed.
- [ ] Bucket sizes do not make the split guessable.

## Flashcard

- [ ] One cue, one fact; the back is the answer plus at most one line.
- [ ] Stands alone in review (no "this", no "above").

## Media

- [ ] `alt` teaches what the media shows or says; a caption says what to watch for.
- [ ] Clip is under 30 s; image or GIF for UI flows; audio for pronunciation.
- [ ] The answer is also in text; media is never the only carrier.
- [ ] Files uploaded before saving; no binaries in git.

## Order

- [ ] Steps listed in the correct order.
- [ ] No two steps could swap and still be right.
- [ ] Steps are similar in length and form.

## Bug

- [ ] Prompt states the intended behavior.
- [ ] Exactly one line is wrong, and it is wrong because of the level's idea.
- [ ] Explanation names the fix.

## Written

- [ ] Prompt is a realistic request.
- [ ] 2–5 key points, one idea each, checkable, non-overlapping.
- [ ] Model answer covers every key point, in the voice the learner should use.

## Kata

- [ ] Statement states every rule the tests check, including edge cases.
- [ ] ≥3 visible tests and ≥2 hidden tests; hidden ones probe stated edges.
- [ ] Starter compiles and fails; solution passes all (the platform validator checks this when it exists).
- [ ] No tests on unstated behavior, key order, randomness or time.

## Theory cards

- [ ] One idea per card; the title names it.
- [ ] Leads with a concrete artifact; prose is short.
- [ ] Traces show real computed values, only the variables that change, and a note on the key steps.
- [ ] Flows use real-looking payloads (headers, JSON) and every hop's actors exist.
- [ ] Code is a real excerpt or runs as shown.

## Course

- [ ] Objectives listed per level; each has ≥2 challenges of different types.
- [ ] Levels ordered by dependency; nothing is tested before it is taught.
- [ ] Each level has 4–8 cards and 5–10 challenges, with an easy win first.
- [ ] A boss level interleaves earlier topics.
- [ ] Rewards only inform; misses feed review.
