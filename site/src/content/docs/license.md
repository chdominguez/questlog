---
title: License
description: Questie is open source. The app is AGPL-3.0, the course format is MIT, and library courses are CC BY 4.0.
---

Questie is open source, in three parts with three licenses.

| Part | License | Paths |
| --- | --- | --- |
| The app: web app, server, mobile apps, MCP server, this website | [AGPL-3.0-only](https://www.gnu.org/licenses/agpl-3.0.html) | everything not listed below |
| The course format: the schema, the authoring helpers, the Claude Code plugin, the authoring docs and the JSON Schema | [MIT](https://opensource.org/license/mit) | `src/course/schema.ts`, `src/course/authoring.ts`, `shared/media.ts`, `scripts/schema-ref.ts`, `plugins/questie/`, `site/src/content/docs/authoring/`, `/schema/course.json` |
| Library courses | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | `courses/` |

`REUSE.toml` in the repo is the file-by-file record, and CI checks it with `reuse lint`.

## What this means for you

**Learners.** The courses you build are yours. Export your progress, notes, answers and courses at any time, and run them on your own copy of Questie. See [Export your data](/self-host/export/).

**Self-hosters.** Run the app for yourself, your team or your school, with your own Anthropic key and every AI feature unmetered. If you change the app and offer it to others over a network, the AGPL asks you to offer them your changed source too.

**Course authors and tool builders.** The format is MIT. Write courses with any tool, build your own player or converter, or ship the schema in a closed product. Point `"$schema"` at [/schema/course.json](/schema/course.json) for editor checks.

**Library users.** Share and adapt any library course for any purpose, including commercially, as long as you credit it.

## Contributions

- App code: a one-time [CLA](/contribute/code/#the-cla).
- Courses, the format and the authoring docs: [DCO sign-off](/contribute/courses/#3-sign-off-every-commit) on each commit.

## Trademark

"Questie" and the Questie mascot are trademarks of chdominguez. Forks may use the code under its license but must not use the name or mascot for a hosted service.

## Fonts

Atkinson Hyperlegible, JetBrains Mono and Caveat are bundled under the SIL Open Font License 1.1.
