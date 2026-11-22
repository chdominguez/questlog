---
title: Course anatomy
description: How a Questie course is laid out, where its files go, and why ids never change.
sidebar: { order: 1, label: Overview }
---

<!-- SPDX-License-Identifier: MIT -->

A Questie course is one object: a title, a language, and a list of levels. Each level is a few theory cards followed by challenges. The same format serves hand-written courses, AI-built courses and every course in the library, and one schema checks them all.

The format is open under the MIT license, so you can build tools on it, write your own player, or keep your courses anywhere you like.

## The shape

```json
{
  "$schema": "https://questie.app/schema/course.json",
  "id": "http-basics",
  "title": "How the web talks: HTTP",
  "lang": "en",
  "summary": "Requests, caching, cookies and CORS.",
  "levels": [
    {
      "id": "requests",
      "order": 1,
      "title": "Requests and responses",
      "theory": [{ "title": "The request", "blocks": [{ "kind": "md", "text": "A request is a method, a path and headers." }] }],
      "challenges": [{ "id": "req-method", "type": "quiz", "prompt": "Which part names the action?", "options": ["The method", "The Host header"], "answer": 0 }]
    }
  ]
}
```

| Part | Page |
| --- | --- |
| Theory cards and their nine block kinds | [Theory blocks](/authoring/theory/) |
| The 11 challenge types | [Challenge types](/authoring/challenges/) |
| Coding exercises with tests | [Katas](/authoring/katas/) |
| Illustrations, images, video and audio | [Art and media](/authoring/art-media/) |
| Grader persona and mock exams | [Grader and mock exams](/authoring/grader-mock/) |
| Every field | [Schema reference](/authoring/reference/) |

## Where the files go

In a Questie checkout, the app loads `courses/*/course.ts|json` and `courses-private/*/course.ts|json`. The folder name matches the course `id`.

| Course | Folder | Committed |
| --- | --- | --- |
| Public: general topics, safe to publish | `courses/<id>/` | yes, in this repo |
| Private: personal notes, work material, interview prep | `courses-private/<id>/` | no; gitignored, often its own repo |

Set `QUESTIE_COURSES` to keep private courses in another folder. The app, `npm run validate` and the MCP server all read it.

## course.ts or course.json

Both hold the same object. Do not keep both in one folder.

- **`course.ts`** with `defineCourse` gives you types, the `at()` and `hl()` helpers, shared constants and split files. Use it when you work in the repo.
- **`course.json`** is the serialized form. The MCP tool `course_save` writes it, the AI builder produces it, and the app's **Download file** gives you one. Add `"$schema"` for editor completion.

Either way a course stays JSON-serializable: no functions, no `undefined`, no class instances.

### Split files

Small courses fit in one `course.ts`. Bigger ones split:

```text
courses/<id>/
  course.ts             defineCourse({...}): imports levels, katas, art
  levels/01-<slug>.ts   export default level (type Level)
  levels/02-<slug>.ts
  katas/<kata-id>.ts    export default kata (type Kata)
  art.ts                export default { "<key>": "<svg ...>" }
  samples.ts            optional: shared sample data, snippets, traces, flows
```

Import helpers and types only from `questie/authoring`:

```ts
import { defineCourse, at, hl } from "questie/authoring";
import type { Level, Kata, TraceStep, FlowStep } from "questie/authoring";

export default defineCourse({
  id: "http-basics",
  title: "How the web talks: HTTP",
  lang: "en",
  levels: [],
});
```

`courses/http-basics/` in the repo is a complete example: split levels and katas, shared samples, three flows, a trace and every challenge type.

## Ids are forever

Course, level, challenge and kata ids are lowercase kebab-case (`^[a-z0-9][a-z0-9-]*$`). Progress, stars, review cards and saved answers are keyed by `<course>:<id>`.

- Never rename or reuse an id in a published course. Fix a typo in the title instead.
- Challenge ids are unique across the whole course, not per level. Prefix them with a level slug: `cache-no-store`, `cors-preflight`.
- Removing a challenge is fine. Its review card stops appearing.

## Levels

`order` places a level on the map; a fractional `order` (such as `2.5`) inserts one between two others. `boss: true` marks the final level, drawn last. `art` names a key in the course's `art` map for the level's map node.

The learner reads the theory cards, then plays the challenges in the order you wrote them, with 3 lives. Stars are the lives left. Put an easy item first.
