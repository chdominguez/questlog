# Challenge types

How to write each type well. Examples use one sample world: a bakery site at `www.example.com` with an API at `api.example.com`.

## Contents

- Quiz (multiple choice)
- Order
- Bug
- Written (self-explanation, graded against key points)
- Kata (coding exercise with tests)
- Explanations

## Quiz (multiple choice)

**Trains** discrimination between similar ideas and prediction of outcomes.

**Write it:**
1. Start from a misconception you expect. The stem asks the question that separates it from the truth.
2. Write the right answer first (Questlog shuffles).
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

## Explanations

Every quiz, order and bug item gets an explanation shown after answering:
- 1–3 sentences.
- Why the right answer is right, and why the most tempting wrong answer is wrong.
- A source or the card it came from when the fact is not obvious ("RFC 9111 §5.2.2.4").
