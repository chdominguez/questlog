---
title: Katas
description: Solve Questie coding katas in a real editor, with Run for quick checks, Submit for hidden tests and Python through Pyodide.
sidebar:
  order: 5
---

Katas are coding exercises you solve in the browser. Your code runs on your own device, against real tests, so you know it works, not just that it looks right.

## Where to find them

- Inside a level, as a kata challenge.
- In the **Dojo** section under the course map, where you can open any kata of the course and practice it again.

## The screen

| Part | What it shows |
|---|---|
| Statement | The task, worked **Examples** (input and output) and notes |
| Editor | The same editor as VS Code (Monaco), with highlighting and autocomplete, loaded with starter code |
| Tests | Each test with a pass or fail mark; failures show **Got** and **Expected** or the error |
| Console | Anything your code prints, per test |

Your code is saved in the browser as you type, so you can leave and come back.

## Run vs Submit

| Button | Runs | Use it to |
|---|---|---|
| **Run** (Ctrl+Enter or Cmd+Enter) | The visible tests | Check your progress as often as you like |
| **Submit** | The visible tests plus hidden tests | Finish the kata |

When every test passes on Submit, the score reads **Solved** and the **Complexity** notes for the solution appear. Inside a level, a solved kata counts as right and earns 40 XP. A failed Submit costs no life: fix the code and submit again.

Each run has 2 seconds, so an endless loop ends with **Timed out** and your editor stays responsive.

## Other buttons

- **Reset** puts the starter code back.
- **Show solution** asks **Show the solution?** first, then shows the reference solution under the editor.
- **Skip**, inside a level, moves on without a life lost. The kata comes back in [review](/learn/review/).

## TypeScript and Python

Most katas are TypeScript. Tests run in a Web Worker, so nothing leaves your browser.

Python katas run in [Pyodide](https://pyodide.org), Python compiled to WebAssembly. Questie downloads it the first time you run a Python kata (about 10 MB), then your browser caches it. `print` output shows in the Console tab. Python katas use the standard library.

Want to write your own katas? See [Katas for authors](/authoring/katas/).
