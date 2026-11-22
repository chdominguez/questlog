# Challenge types

How to write each type well. Examples use one sample world: a bakery site at `www.example.com` with an API at `api.example.com`.

## Contents

- Quiz (multiple choice)
- Multi (multi-select and true/false)
- Match
- Cloze
- Sort
- Flashcard
- Order
- Bug
- Written (self-explanation, graded against key points)
- Kata (coding exercise with tests)
- Media in theory and prompts
- Explanations

## Quiz (multiple choice)

**Trains** discrimination between similar ideas and prediction of outcomes.

**Write it:**
1. Start from a misconception you expect. The stem asks the question that separates it from the truth.
2. Write the right answer first (Questie shuffles).
3. Write 2–3 distractors, each one a specific wrong belief. Name the belief to yourself; if you cannot, the distractor is filler.
4. Equalize length and style. Read the options without the stem: if one stands out, rewrite.

**Good stems:** "What does the browser do with…", "Which header…", "What is printed…", "Which change fixes…", scenario + "what happens next?".

**Example.**
> A response has `Cache-Control: no-cache`. What may the browser do with it?
> - Store it, but revalidate with the server before every reuse ✓
> - Use it without asking the server until it expires *(confuses no-cache with max-age)*
> - Never store it *(confuses no-cache with no-store)*
> - Store it only in memory, not on disk *(invented behavior that sounds plausible)*

**Avoid:** trivia (port numbers nobody needs), "which is true" stems with four unrelated statements, a right answer that copies a phrase from the theory card verbatim while distractors don't.

## Multi (multi-select and true/false)

**Trains** knowing every fact that holds, and rejecting a plausible false one.

**Write it:**
- Multi-select: 4–6 options, 2–3 of them right, at least one wrong. The prompt says "Which of these…" without a count, so guessing the count does not help.
- Grading is strict: the exact set is right; only right picks and at least half of them is partial credit; any wrong pick is wrong. Do not make an option right only under a reading the explanation has to defend.
- **True/false** (`style: "truefalse"`) is one statement with options `["True", "False"]`. Use it for a **misconception**: a statement a half-learner believes. Most should be false, but not all, or the answer becomes a habit.
- Each option stands alone; no "both of the above".

**Example.** "`no-cache` means the browser never stores the response." True / False. (False: it may store it but must revalidate.)

## Match

**Trains** term-to-definition and cause-to-effect links.

**Write it:**
- 3–8 pairs (aim for 4–6); every left and every right is unique.
- All rights are the same kind of thing, similar in length, and each belongs to exactly one left. No right that fits two lefts.
- Wrong links cost nothing but the result: all right is ok; up to 2 wrong, and under half, is partial.

**Example.** `404` → "No such resource"; `403` → "Known, not allowed"; `301` → "Moved for good"; `503` → "Try again later".

## Cloze

**Trains** recall of exact syntax or terms in context.

**Write it:**
- Text with `{{1}}`, `{{2}}`… markers; 1–3 blanks. More than three turns it into a guessing chain.
- A blank must have one right term. List accepted variants in `answers` (first is shown as the answer). Use `exact: true` only where case or spacing matters (code).
- Typed blanks train recall; a `bank` of chips (include 1–2 decoys) is easier and fits phones. Use typed for syntax the learner must produce.
- For code use `lang`, and keep blanks to keywords or names the level taught.

**Example.** "To make a browser revalidate before every reuse, send `Cache-Control: {{1}}`." Answer: `no-cache`.

## Sort

**Trains** classification into categories.

**Write it:**
- 2–4 buckets, 4–12 items, every bucket with at least one item.
- Categories are mutually exclusive and clear from their labels; every item belongs to exactly one. Avoid edge cases that need an argument.
- Mix item sizes so the buckets are not guessable by count.

**Example.** Buckets "Safe method" / "Unsafe method"; items `GET`, `HEAD`, `POST`, `DELETE`.

## Flashcard

**Trains** high-volume recall with the learner's own judgment.

**Write it:**
- The prompt is the front: one cue, one answer. The `back` is the answer plus at most one line of context.
- Self-rated Again/Hard/Good/Easy; the rating sets the review interval (FSRS). It pays little XP and never costs a life, so use it for facts worth memorizing, not for reasoning.
- One fact per card; reversible facts get two cards. Keep cards findable in review: no "this", no "the above".

**Example.** Front: "Which header makes a response cacheable for an hour?" Back: "`Cache-Control: max-age=3600`".

## Order

**Trains** sequence knowledge: processes, lifecycles, protocol steps, algorithm phases.

**Write it:**
- 4–7 steps in the correct order (the UI shuffles).
- Every step must have a single defensible position. If two steps can swap, merge them or drop one.
- Steps similar in length; start each with a verb or the actor ("Browser sends…").

**Example.** Loading `https://www.example.com/menu` for the first time: resolve the name with DNS → open a TCP connection → TLS handshake → send `GET /menu` → server answers `200 OK` with HTML → browser parses the HTML and requests the stylesheet.

## Bug

**Trains** code reading: finding the line that violates a rule from the level.

**Write it:**
- 4–10 lines of real-looking code, one statement per line.
- **Exactly one** line is wrong, and it is wrong because of the level's idea, not a typo or a style choice.
- The prompt states the intended behavior ("This cache must never keep `no-store` responses"). Without the spec, "bug" is ambiguous.
- Other lines are correct and plausible, including some that look suspicious but are fine.
- The explanation names the fix.

**Avoid:** bugs that need the whole program to see, two lines that are each half the bug, syntax errors.

## Written (self-explanation, graded against key points)

**Trains** recall and explanation: "why", "walk me through", "what would you change", trade-offs.

**Write it:**
- The prompt is a realistic request: "A teammate set `no-cache` to turn caching off. What does it actually do, and what should they set instead?"
- **Key points**: 2–5 short, independently checkable claims a strong answer must contain. Each is one idea. They are what the grader scores; the model answer is a reference.
- **Model answer**: 60–150 words, in the voice the learner should use (spoken style for interview practice, plain prose otherwise), covering every key point.
- Optional **soft time limit** when fluency matters (45–90 s for a spoken answer).

**Example key points:**
- no-cache allows storing but requires revalidation before each reuse
- revalidation can return 304 and save the body transfer
- no-store forbids storing any part of the response
- for sensitive data, use no-store

**Avoid:** key points that are vague ("talks about caching"), that overlap, or that need the exact wording.

## Kata (coding exercise with tests)

**Trains** a procedural skill by writing a small function.

**Write it:**
- **Statement**: the function signature, inputs, output and every rule, including edge cases (empty input, duplicates, casing, whitespace). Tests may only check rules the statement states.
- **Examples**: 2–3 input/output pairs, one showing an edge case.
- **Starter**: the signature and a trivial body that compiles and fails at least one test.
- **Solution**: the simplest clear solution; it must pass every test.
- **Tests**: ≥3 visible (run while working) covering the main case and one edge; ≥2 hidden (on submit) covering edges the statement promised: empty, repeated, large, odd casing.
- **Complexity**: time and space, plus one line on the real-world version.
- Size: 5–25 lines of solution. Easy = one loop or one standard API; medium = one data structure decision; hard = a known algorithm.

**Avoid:** tests that depend on unstated behavior, floating-point equality without rounding, order of object keys, randomness, time.

## Media in theory and prompts

- A `media` block (image, GIF, video, audio) goes in a theory card after the sentence that introduces it; a Markdown image `![alt](media/x.png)` works in `md` blocks and in challenge prompts and explanations.
- Clips under 30 s, with a caption naming what to watch for. Alt text states what the media shows or says.
- Image or GIF for UI flows; audio for pronunciation and listening; video when motion or narration matters.
- A challenge may show media, but the correct answer must also be derivable from text the learner studied. Media alone must not be the only carrier of a fact.

## Explanations

Every quiz, multi, match, cloze, sort, order and bug item gets an explanation shown after answering:
- 1–3 sentences.
- Why the right answer is right, and why the most tempting wrong answer is wrong.
- A source or the card it came from when the fact is not obvious ("RFC 9111 §5.2.2.4").
