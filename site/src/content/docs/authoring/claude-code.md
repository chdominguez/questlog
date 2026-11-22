---
title: Claude Code plugin
description: Install the Questie plugin for Claude Code and build courses from a topic, your notes or a repo.
sidebar: { order: 11 }
---

<!-- SPDX-License-Identifier: MIT -->

The Questie plugin gives Claude Code two skills that turn a request like "make me a course on Postgres indexes" into a validated course in your checkout.

## Install

In Claude Code:

```text
/plugin marketplace add chdominguez/questlog
/plugin install questie@questie
```

Then open Claude Code in a Questie checkout (run `npm install` once) so the course files, the validator and the [MCP server](/authoring/mcp/) are at hand.

### Coming from Questlog

The plugin was called `questlog`. Remove the old one, then install as above:

```text
/plugin uninstall questlog@questlog
/plugin marketplace remove questlog
```

## The two skills

| Skill | What it does |
| --- | --- |
| `quest-design` | Turns a topic into a learning quest: objectives per level, level order, theory cards, the challenge mix, item-writing rules, gamification that helps, and a final self-review against the item checklist. Platform-agnostic. |
| `questie-course` | Turns that design into valid Questie files: where they go, `course.ts` or `course.json`, traces with `at()`, highlights with `hl()`, flows, art rules, the grader persona, stable ids, and the validate, test and run loop. |

Claude loads them on its own when you ask for a course, a level, a kata or a fix to validation errors. `questie-course` loads `quest-design` first.

## How Claude works

1. **Outline.** Objectives and a level list. For more than about 3 levels, or any private course from notes, Claude shows you the outline and waits.
2. **Write** one level at a time, starting with the shared sample data, traces and flows. Trace values come from running the code.
3. **Validate** with `npm run validate <id>` until it passes.
4. **Critic pass** over every card and item, as a learner would read it.
5. **Test** with `npx vitest run` and `npx tsc --noEmit -p .`.
6. **Play it** in the browser at phone and desktop width.
7. **Report** the files, the outline, the results and anything it could not verify.

## Example prompts

From a topic:

```text
Make a public Questie course on HTTP caching for junior web developers.
Four levels and a boss, with a trace of the freshness check and a kata.
```

From your notes:

```text
Turn my notes tagged "kubernetes" into a private course.
Keep my terms, and flag anything in the notes that looks wrong.
```

From a repo:

```text
Build a private course that teaches a new teammate how this repo handles auth.
Use real excerpts from the code, with file paths in the card titles.
```

## Public or private

| Course | Folder | Committed |
| --- | --- | --- |
| Public: general topics, safe to publish | `courses/<id>/` | yes |
| Private: your notes, work or interview prep | `courses-private/<id>/` | no (gitignored, often its own repo) |

Anything built from personal material defaults to private. Set `QUESTIE_COURSES` to keep private courses somewhere else; the app and the validator both read it.
