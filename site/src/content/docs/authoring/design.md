---
title: Designing a course
description: Objectives, level structure, the challenge mix and the item checklist behind a Questie course that teaches.
sidebar: { order: 8 }
---

<!-- SPDX-License-Identifier: MIT -->

Questie is built on two of the most effective study techniques in learning research: retrieval practice (testing yourself) and spaced practice (Dunlosky et al., 2013). Every challenge is retrieval practice, and the review queue supplies the spacing. Your job as an author is to make every item worth retrieving.

## Workflow

1. **Scope.** Who is the learner, what do they already know, what will they do afterwards, and which sources are authoritative.
2. **Objectives.** 3 to 6 per level, each written as "After this level the learner can *verb* *thing*": explain, predict, choose, order, spot, write, compute. Never "understand".
3. **Level map.** Group objectives into levels, order them by dependency, end with a boss level.
4. **Cards**, then **challenges** that each test one objective. Every objective gets at least two challenges of different types.
5. **Verify.** Run every snippet. Check every claim against a source.
6. **Self-review** with the checklist below.

## Levels

- One level is one idea cluster a learner can hold at once: "status codes and caching", not "HTTP part 2".
- 4 to 8 theory cards and 5 to 10 challenges.
- A level tests only what it or an earlier level taught.
- The boss level comes last and mixes every earlier level, leaning on written answers and katas.
- Keep one sample world per level, ideally per course: the same user, ids, URLs and numbers across cards, traces, flows and challenges.

## Theory cards

- One idea per card, and the title names it.
- Lead with a concrete artifact (a request, a snippet, a diagram), then 2 to 5 sentences on what to notice.
- Pick the block by the idea: values changing over time is a `trace`, a message moving between systems is a `flow`, structure or states is a `mermaid` diagram, a static excerpt is `code` with the key lines highlighted.
- Add a `drill` after a table of pairs, or a `practice` challenge after a key fact, so the learner recalls while reading.
- End the theory on what the challenges ask about.

## The challenge mix

| Type | Trains | Per level |
| --- | --- | --- |
| `quiz` | Telling similar ideas apart, predicting an outcome | 2 to 5 |
| `multi` and true/false | Complete facts, misconception busting | 0 to 2 |
| `match` | Term to definition links | 0 to 1 |
| `cloze` | Exact syntax or terms | 0 to 2 |
| `sort` | Classification | 0 to 1 |
| `flashcard` | High-volume recall | 0 to 10 |
| `order` | Sequences and lifecycles | 0 to 1 |
| `bug` | Code reading | 1 to 2 |
| `written` | Explaining why, walking through, trade-offs | 1 to 3 |
| `kata` | Writing a small function | 0 to 2 |

- Mix types inside a level and put an easy win first.
- When the objective is to produce something, prefer recall (written, kata) over recognition (quiz).
- Early levels lean on quizzes, a match or sort for vocabulary and a true/false or two. Middle levels add cloze, multi, order and bug. The boss leans on written answers, katas and mixed-concept items.

## Good items

Every item is:

- **Focused**: one idea.
- **Precise**: one defensible answer.
- **Consistent**: the same answer every time it comes back in review.
- **Tractable**: a learner who studied gets it right.
- **Effortful**: the answer comes from memory, not from cues in the question.

For multiple choice: 3 or 4 options, each distractor a real misconception, similar lengths, no "all of the above", no grammar cues, and negatives in **bold** when they are the point.

## Facts you can trust

A course teaches whatever it says, and review reinforces it. So:

- Use the learner's own material first and keep its terms.
- Cite the spec section, doc page or file path for every non-obvious claim.
- Never invent APIs, flags, versions or numbers.
- Run the code. Trace values come from execution, not from imagination.
- Excerpts from a real codebase are real lines, trimmed with `// ...` where needed.

## Checklist

Before you ship, reread every item cold, as a learner seeing it weeks later in review:

- [ ] It tests one idea a card taught, and stands alone out of context.
- [ ] It has exactly one defensible answer, checked against the source.
- [ ] Its explanation says why the right answer is right and why the tempting one is wrong.
- [ ] It uses the level's sample data.
- [ ] Written challenges have 2 to 5 checkable key points and a model answer that covers them.
- [ ] Katas state every rule the tests check; the starter fails and the solution passes.
- [ ] Media has teaching alt text, and the answer is also in the text.
- [ ] Every level has objectives, 4 to 8 cards and 5 to 10 challenges, and a boss level closes the course.
