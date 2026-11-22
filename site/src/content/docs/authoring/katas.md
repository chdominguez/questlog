---
title: Katas
description: Write coding exercises with visible and hidden tests, in TypeScript or Python.
sidebar: { order: 4 }
---

<!-- SPDX-License-Identifier: MIT -->

A kata is a small function the learner writes in the browser. It lives in the course's `katas` list and appears in a level through a [`kata` challenge](/authoring/challenges/#kata) that points at its id.

## The kata object

| Field | Required | What it does |
|---|---|---|
| `id` | yes | Lowercase kebab-case, unique among katas. |
| `title` | yes | Shown on the kata screen. |
| `difficulty` | yes | `easy`, `medium` or `hard`. |
| `statement` | yes | Markdown: the signature, inputs, output and every rule, edge cases included. |
| `examples` | yes | At least one `{ "input", "output", "note"? }`. |
| `lang` | no | `ts` (default) or `python`. |
| `starter` | yes | The code the learner starts from. It must compile and fail at least one test. |
| `solution` | yes | A reference solution. It must pass every test. |
| `complexity` | yes | Markdown: time and space complexity. |
| `tests` | yes | At least 3 visible tests, run with **Run**. |
| `hidden` | yes | At least 2 more tests, run with **Submit**. |

A test is `{ "name", "code" }`. `code` is a function body that runs after the learner's code and must `return eq(got, expected)`. `eq` compares deeply; in TypeScript katas, `Map` and `Set` compare without regard to order.

## A TypeScript kata

```json kata
{ "id": "sum", "title": "Sum a list", "difficulty": "easy", "statement": "Return the sum of `xs`.",
  "examples": [{ "input": "[1, 2]", "output": "3" }],
  "starter": "function sum(xs: number[]): number {\n  return 0;\n}",
  "solution": "function sum(xs: number[]): number {\n  return xs.reduce((a, b) => a + b, 0);\n}",
  "complexity": "O(n) time, O(1) space.",
  "tests": [{ "name": "two", "code": "return eq(sum([1, 2]), 3)" }, { "name": "empty", "code": "return eq(sum([]), 0)" }, { "name": "negative", "code": "return eq(sum([-1, 1, 5]), 5)" }],
  "hidden": [{ "name": "one", "code": "return eq(sum([7]), 7)" }, { "name": "many", "code": "return eq(sum([1, 2, 3, 4]), 10)" }] }
```

`export` in the starter or the solution is stripped, so either style works.

## A Python kata

Set `"lang": "python"`. The starter, the solution and every test body are Python. `eq` compares with `==`, so lists, dicts and sets work. `print` output shows in the Console tab. In the browser, Python runs through Pyodide, downloaded on the first run. Use the standard library only.

```json kata
{ "id": "sum-py", "title": "Sum a list in Python", "difficulty": "easy", "lang": "python", "statement": "Return the sum of `xs`.",
  "examples": [{ "input": "[1, 2]", "output": "3" }],
  "starter": "def sum_list(xs):\n    return 0",
  "solution": "def sum_list(xs):\n    total = 0\n    for x in xs:\n        total += x\n    return total",
  "complexity": "O(n) time, O(1) space.",
  "tests": [{ "name": "two", "code": "return eq(sum_list([1, 2]), 3)" }, { "name": "empty", "code": "return eq(sum_list([]), 0)" }, { "name": "negative", "code": "return eq(sum_list([-1, 1, 5]), 5)" }],
  "hidden": [{ "name": "one", "code": "return eq(sum_list([7]), 7)" }, { "name": "many", "code": "return eq(sum_list([1, 2, 3, 4]), 10)" }] }
```

The validator runs Python katas with the `python3` on your machine.

## How the validator checks katas

`npm run validate` runs every kata twice:

1. The solution against `tests` and `hidden`. Every test must pass.
2. The starter against the same tests. It must compile and fail at least one.

AI-built courses pass the same check before you see them: TypeScript katas run in a sandbox with time and memory limits, and Python katas are checked statically on the server.

## Writing good katas

- State every rule the tests check: empty input, duplicates, casing, whitespace. Tests only check what the statement says.
- Give 2 or 3 examples, one of them an edge case.
- Make the starter return a wrong default (`0`, `[]`, `{}`) so it compiles and fails.
- Visible tests cover the main case and one edge. Hidden tests cover the edges the statement promised.
- Keep solutions to 5 to 25 lines. Easy is one loop or one standard API; medium is one data structure decision; hard is a known algorithm.
- Avoid tests that depend on object key order, floating-point equality without rounding, randomness or the clock.
