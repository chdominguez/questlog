---
title: Grader and mock exams
description: Set how Claude grades written answers in your course, and add a timed mock exam.
sidebar: { order: 6 }
---

<!-- SPDX-License-Identifier: MIT -->

## Language

`lang` is the BCP 47 tag of the course content, such as `en` or `es-ES`. Grading, dictation and dates follow it. Write every string in that language, including the grader persona.

## Grader persona

`grader.persona` tells Claude who is grading written answers and how strict to be. Name the role, the bar for 10, 7, 5 and 3, and the tone of the stronger answer.

```json
{
  "grader": {
    "persona": "You are a senior web engineer reviewing a junior colleague's explanation. Be strict about protocol facts and fair about wording. 10 = precise and complete; 7 = right with small gaps; 5 = vague; 3 or less = wrong or missing the key mechanism. Write the stronger answer in plain, spoken English."
  }
}
```

Each grade scores the answer from 0 to 10 against the challenge's `keyPoints` and lists the points covered and missed. 7 or more counts as right, 4 to 6 as partial, below 4 as a miss. A written answer never costs a life.

Write key points that are short, one idea each and checkable on their own. They are what the grader scores; the `model` answer is the reference.

## Mock exams

`mock` adds a timed exam of written answers to the course.

```json
{ "mock": { "title": "HTTP interview", "seconds": 720 } }
```

| Field | What it does |
| --- | --- |
| `title` | Shown on the mock exam screen. |
| `seconds` | Time for the whole exam, a positive whole number. |

The exam uses the boss level's written challenges. When the boss level has none, it takes up to 8 random written challenges from all levels. Add a mock only when that gives 3 or more questions, and allow about 90 seconds per question.

Learners pay for a mock exam once per session; every answer in the session is graded with no further charge. See [Mock exams](/learn/mock/) for how learners use it.
