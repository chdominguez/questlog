---
title: Validate and test
description: Check a Questie course with the validator, read its errors and run it before you ship.
sidebar: { order: 7 }
---

<!-- SPDX-License-Identifier: MIT -->

One validator checks every course: the ones you write, the library, and every course the AI builder makes. It runs the schema, the cross-field rules and every kata.

## Run it

In a Questie checkout:

```sh
npm run validate              # every course
npm run validate http-basics  # one course, by id or folder
```

Each course prints a check mark or a cross, then one problem per line with the exact path:

```text
✗ /home/you/questie/courses/http-basics/course.ts
  levels[1].challenges[4].answer: answer 4 but only 3 options
```

A file that throws while loading (a bad `at` or `hl` needle, a syntax error) is reported as `failed to load: ...`. The command exits with code 1 when any course has a problem, so it works as a CI check.

The MCP tool `course_validate` runs the same checks on a course object without saving it.

## Then test and play it

1. `npx vitest run` validates every course again and runs every kata.
2. `npx tsc --noEmit -p .` type-checks `course.ts` files.
3. `npm run dev` and play one level end to end at phone width (about 390 px) and at desktop width. Step through every trace and flow, answer a few challenges and open a kata. The **Unlock all** switch on the map opens every level.

## Common errors

| Message | Fix |
|---|---|
| `at: "x" matches 0 lines` / `matches 2 lines` | Pick a needle that appears on exactly one line of that `src`. |
| `hl: "x" not found` | The needle is not in the snippet; check whitespace and quotes. |
| `"X" is not one of the actors` | Flow step `from`/`to` must match an `actors` entry exactly. |
| `art "x" is not in course.art` | Add the SVG under that key or fix the key. |
| `root must not set width/height` / `no ... hex colors` | Follow the [art rules](/authoring/art-media/#inline-svg-art). |
| `starter already passes every test` | Make the starter return a wrong default (`[]`, `{}`, `0`). |
| `solution fails "name"` | Fix the solution or the test; run the solution by hand to see the value. |
| `must look like "media/<file>" ...` | `src`/`poster` must be flat `media/<file>`: no folders, scheme, leading slash or `..`. |
| `extension must be one of ...` | Use an allowed extension for the block's `type` (a GIF is `type: "image"`; `poster` must be an image). |
| `only videos have a poster` | Remove `poster` from image and audio blocks. |
| `answers must be fewer than options (...)` | A `multi` needs at least one wrong option. |
| `answers must be unique` / `answers [..] but only N options` | Fix the `multi` `answers` indexes. |
| `truefalse needs exactly 2 options and 1 answer` | Use `options: ["True", "False"]` and a single answer. |
| `duplicate left item` / `duplicate right item` | Every `match` left and every right must be unique. |
| `markers must be {{1}}..{{N}} in order, once each, matching blanks` | Renumber the cloze markers to match `blanks`. |
| `"x" is not in bank` | Each cloze blank's first answer must appear in `bank`, or drop `bank`. |
| `bucket N but only M buckets` / `bucket N has no items` | Fix `sort` item bucket indexes; give every bucket an item. |
| `Unrecognized key` | A field is misspelled or does not exist; schemas are strict. |
