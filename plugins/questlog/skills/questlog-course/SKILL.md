---
name: questlog-course
description: Creates, extends or ports a course for Questlog, the gamified learning app (React + TypeScript), in a Questlog checkout. Covers where course files go (public courses/ or private courses-private/), course.ts with defineCourse or course.json, levels and katas split into files, step-through traces with at(), code highlights with hl(), request flows, inline SVG art rules, the grader persona, stable ids, building from a topic, from the user's notes or from a real repo, and the validate-test-run loop. Use when the user asks to "make a Questlog course", "add a level", "add a kata", "turn my notes into a course", "port this course to Questlog", "fix course validation errors", or edits files under courses/ or courses-private/.
---

# Questlog course authoring

**Load the `quest-design` skill first** and follow its workflow (objectives → levels → cards → challenges → verify → self-review). This skill covers only how that design becomes valid Questlog files.

## Capabilities at a glance

- **Theory blocks** (`kind`): `md`, `code`, `mermaid`, `figure`, `trace`, `flow`, `media` (image, GIF, video, audio), and the reinforcement games `drill` and `practice`.
- **Challenge types** (`type`): `quiz`, `multi` (incl. `style: "truefalse"`), `order`, `bug`, `written`, `match`, `cloze`, `sort`, `flashcard`, `kata`.
- **MCP tools**: `course_list`, `course_get`, `course_validate`, `course_save`, `media_upload`, `media_list`, `note_search`, `note_get`.

## Before you start

- Confirm you are in a Questlog checkout: `src/course/schema.ts` and `scripts/validate.ts` exist. If `node_modules` is missing, run `npm install`.
- `src/course/schema.ts` is the contract. Field reference: [references/schema.md](references/schema.md). A complete annotated course using every block and challenge type: [references/example.md](references/example.md).
- Read one existing course to match its style. `courses/http-basics/` is a complete public example: split levels and katas, shared `samples.ts`, three flows, a trace, every challenge type.

## Where the files go

| Course | Folder | Committed |
|---|---|---|
| Public: general topics, safe to publish | `courses/<id>/` | yes, in this repo |
| Private: personal notes, employer or project details, interview prep, people | `courses-private/<id>/` | no; gitignored here, often its own repo |

Ask the user which one when it is not obvious. **Anything built from personal material defaults to private.** Never copy personal content into a public course. The private folder can be relocated with the `QUESTLOG_COURSES` env var; both `npm run validate` and the app read it.

The app loads `courses/*/course.ts|json` and `<private>/*/course.ts|json`. The folder name should equal the course `id`.

## File layout

Small course (≤2 levels): one `course.ts`.

Anything bigger:

```
courses/<id>/
  course.ts          # defineCourse({...}): imports levels, katas, art
  levels/01-<slug>.ts   # export default level (type Level)
  levels/02-<slug>.ts
  katas/<kata-id>.ts    # export default kata (type Kata)
  art.ts                # export default { "<key>": "<svg …>" }  (or art.json)
  samples.ts            # optional: shared sample data, snippets, traces, flows
```

Import helpers and types only from `questlog/authoring`:

```ts
import { defineCourse, at, hl } from "questlog/authoring";
import type { Level, Kata, TraceStep, FlowStep } from "questlog/authoring";
```

### course.ts vs course.json

- Write **`course.ts`** with `defineCourse` when you work in the repo: types, `at()`, `hl()`, shared constants, split files.
- **`course.json`** is the same object serialized. The questlog MCP tool `course_save` writes `course.json`. Do not keep both in one folder. A course must stay JSON-serializable either way: no functions, no `undefined`, no class instances.

## Ids are forever

Course, level, challenge and kata ids are lowercase kebab-case (`^[a-z0-9][a-z0-9-]*$`). Progress, stars, review cards and saved answers are keyed by `<course>:<id>`.

- **Never rename or reuse an id in a published course.** Renaming silently drops the learner's progress and review history. Fix a typo in the title instead.
- Challenge ids are unique across the whole course, not per level. Prefix them with a level slug: `cache-no-store`, `cors-preflight`.
- Removing a challenge is fine; its review card just stops appearing.

## Writing the content

### Levels

`order` positions a level on the map; `boss: true` draws it last. Theory cards are shown first, then challenges in authored order; the learner has 3 lives, each wrong quiz/multi/order/bug/match/cloze/sort answer costs one, and losing all three fails the level. Stars = lives left. So: put an easy item first, and keep wrong-answer-prone items (bug, order) after the learner has warmed up.

XP per type: quiz 10, multi 15, order 15, bug 15, match 15, sort 15, cloze 20, written 25, kata 40, flashcard 8, multiplied by a combo (×1.5 at 3 in a row, ×2 at 5). Written answers score 0–10 from the grader: ≥7 counts as right, 4–6 partial, <4 a miss (no life lost). Every result schedules the item in FSRS review.

### Theory blocks

- `md`: Markdown prose. Short.
- `code`: a static excerpt. Highlight the key lines with `highlight: hl(src, "needle", …)`; `hl` throws if a needle is missing, so edits can't silently drop a highlight.
- `trace`: a step-through run. Each step's `line` comes from `at(src, "unique needle")`, which throws unless exactly one line matches. `vars` lists **only values that change** at that step (earlier ones carry forward); values are display strings, so quote strings yourself: `{ status: '"stale"' }`. To reset a variable for a second run, set it to `"—"`. Add a `note` on the steps that teach.
- `flow`: `actors` left to right in the order the request first reaches them; each step `from`/`to` must be an actor (same actor = self-call); `label` is the arrow text (keep it under ~28 chars so it fits on a phone); `data` is the payload shown under the lanes, `lang` defaults to `json` (use `http` for raw messages, `ts`, `sql`, `text`). Keep 4–9 hops.
- `mermaid`: a diagram source (sequence, flowchart, state). Keep labels short.
- `drill`: `{ kind: "drill", pairs: [{ left, right }, …] }` (3–12 pairs). Put it right after a table or term list; the learner matches one pair, then two, then three (one new each round), then all. Same pairs as the table, short sides.
- `practice`: `{ kind: "practice", challenge: { id, type, prompt, … } }` with type quiz, multi, order, match, sort or cloze. Put it right after the block it reinforces: cloze over the key lines of a template, order for a process, sort for a categorization, quiz for one key fact. Not recorded, costs no lives; ids must still be unique among challenges (e.g. `<level>-p-<topic>`).
- `figure`: shows an art key from `course.art`, with an optional caption.
- `media`: an uploaded image, GIF, video or audio file: `{ kind: "media", type: "image" | "video" | "audio", src: "media/demo.mp4", alt, caption?, poster? }`.
  - `alt` is required: say what the media shows or says (it is what a learner who cannot play it gets). A GIF is `type: "image"`.
  - `src` is flat `media/<file>` (letters, digits, `.` `_` `-`; no folders). Extensions: image `png jpg jpeg webp gif avif`; video `mp4 webm`; audio `mp3 ogg m4a wav`. `poster` (video only) is an image ref.
  - **Upload first, then save the course**: `media_upload` (give `course_id`, `filename`, and exactly one of `path` or base64 `data`; `overwrite: true` to replace) returns the ref to paste into `src`. `media_list` shows what is stored. The size cap is `MEDIA_MAX_BYTES` (default 50 MB). The validator checks the ref format only, not that the file exists, so check with `media_list`.
  - Files live in the server's media folder (`MEDIA_DIR`, else `media/` next to the database), not in the course folder. Never commit binaries to git.
  - Markdown images work in `md` blocks and in a challenge's `prompt` and `explain`: `![alt](media/shot.png)`. They are not rewritten in options, steps or notes.
  - Keep clips short; prefer image or GIF for UI flows. Never make media the only carrier of an answer.

**Keep lines short.** On a phone a snippet shows about 35 characters before it scrolls sideways, and the highlighted line of a trace must be readable without scrolling. Aim for ≤40 characters per line in `trace` and `code` blocks and bug `lines`: short names, one statement per line, comments in the card text instead of at line ends. Flow payloads may be wider (they are reference material).

**Compute trace values by running the code** (e.g. `npx tsx -e '…'` with logging), never by guessing.

### Challenges

- `quiz`: right option **first**, `answer: 0` (the UI shuffles). 3–4 options.
- `order`: `steps` in the **correct** order (the UI shuffles).
- `bug`: `lines` (one statement each), `answer` = 0-based index of the one wrong line, `lang`. The prompt must state the intended behavior.
- `written`: `model` answer, 2–5 `keyPoints`, optional `seconds` soft limit. Graded by Claude against the key points through the server (`npm run server`, needs `ANTHROPIC_API_KEY`).
- `kata`: `kataId` points at an entry in `course.katas`.
- `multi`: `options` (2–6), `answers` = 0-based indexes of every right option (unique, fewer than options). Shuffled by the UI. Add `style: "truefalse"` for a statement: `options` exactly `["True", "False"]`, one answer, fixed order.
- `match`: `pairs: [{ left, right }]`, 3–8, unique lefts and unique rights. The UI shuffles the right column.
- `cloze`: `text` with markers `{{1}}`, `{{2}}`… (once each, in order), `blanks: [{ answers: [...], exact? }]`, optional `bank` (chips; each blank's first answer must be in it; omit for typed blanks), optional `lang` to render the text as code. Answers match ignoring case and extra whitespace unless `exact: true`.
- `sort`: `buckets` (2–4 labels), `items: [{ text, bucket }]` (4–12; `bucket` is a 0-based index; every bucket needs an item).
- `flashcard`: prompt is the front, `back` is the reveal. The learner rates Again/Hard/Good/Easy, which sets the FSRS interval; there is no right or wrong, so it never costs a life.

Grading: `multi` the exact set is ok, only right picks and at least half of them is partial, else wrong. `match` all right ok, ≤2 wrong and under half partial. `cloze` all blanks ok, at least half partial. `sort` all ok, at least half partial. Partial pays half XP, resets the combo and costs no life.

All types accept `explain` (shown after answering); give it to every quiz, order and bug. `code` shows a snippet with the prompt (not for `bug` or `written`).

### Katas

Tests are JavaScript that runs after the learner's code and must `return eq(got, expected)` (deep equality; Map/Set compare order-insensitively). `export` in starter or solution is stripped, so either style works. The validator runs the solution against all tests (must pass) and the starter (must compile and fail at least one). Need ≥3 `tests` and ≥2 `hidden`. Test only behavior the statement states.

**Python katas**: set `lang: "python"` on the kata. `starter` and `solution` are Python; each test `code` is a Python function body that ends in `return eq(got, expected)` (`eq` compares with `==`, so lists, dicts and sets work). `print` shows in the Console tab. The browser runs it in Pyodide (downloaded on first run); the validator needs `python3` on the machine. Standard library only.

### Art

`course.art` maps keys to inline SVG strings; use them in `level.art` (the map node) and `figure` blocks. Rules enforced by `artProblem` in the schema:

- One `<svg …>…</svg>` with a `viewBox` and **no** `width`/`height` on the root.
- Under 4 KB.
- No `href`, `url(…)`, `<image>`, `<script>`, and **no hex colors**. Color with theme variables so it works in light and dark: `var(--accent)`, `var(--accent-ink)`, `var(--ok)`, `var(--info)`, `var(--gold)`, `var(--bad)`, `var(--muted)`, `var(--fg)`, `var(--line)`, `var(--raise)`, `var(--surface)`, `var(--bg)`.
- House style: `viewBox="0 0 120 120"`, a `<circle cx="60" cy="60" r="54" fill="var(--raise)"/>` backdrop, flat shapes, thick strokes, a single subject that reads at 48 px. No text.
- Include `xmlns="http://www.w3.org/2000/svg"` on the root.

### Course fields

- `lang`: BCP 47 tag of the content (`en`, `es-ES`). Used for grading, dictation and dates. Write every string in that language.
- `summary`: one line for the home screen.
- `grader.persona`: who grades written answers and how strict, **in the course language**. Name the role, the bar for 10/7/5/3, and the tone of the improved answer. Example: "You are a senior web engineer reviewing a junior colleague's explanation. Be strict about protocol facts…".
- `mock` (optional): `{ title, seconds }` adds a timed exam of written answers. It uses the boss level's written challenges, or, when the boss has none, up to 8 random written challenges from all levels. Add it only when that yields 3 or more questions, and give it about 90 s per question.

## Modes

**From a topic.** Use quest-design. Cite specs or official docs in card text and explanations. Use reserved example data (`example.com`, `203.0.113.0/24`, `555-` numbers).

**From the user's notes.** If the questlog MCP server is connected, use `note_search` and `note_get` to find and read the notes; otherwise ask for the files. Quote the notes, keep their terms, and flag where they look wrong instead of silently fixing them. Default to a private course. With MCP you can also `course_list`, `course_get` (read an existing course), `course_validate` and `course_save` (writes `course.json`).

**From a repo or docs.** Read the real code first. Snippets, traces and flows must be **real excerpts** (trimmed with `// …` is fine), with the file path in the card title or text. Payloads in flows should match the real request and response shapes. Never paraphrase code into something that looks real.

**Extending or porting.** Keep every existing id. Add levels with new ids and `order` values; to insert between levels, use a fractional `order` (e.g. 2.5). When porting from another format, map each item to the closest challenge type and rewrite it to pass the quest-design checklist.

## The loop

1. **Outline**: objectives and level list (id, title, one-line scope, planned cards and challenges). For more than ~3 levels, or any private course from notes, show it to the user and wait for confirmation.
2. **Write** one level at a time, starting with shared sample data, traces and flows.
3. **Upload media** (only if the course uses it): `media_upload` each file, then `media_list` to confirm the refs you will put in `src`. Do this before `course_save`.
4. **Validate**: `npm run validate <id>`. Messages name the exact path, e.g. `levels[1].challenges[4].answer: answer 4 but only 3 options`. Fix and repeat until `✓`. A file that throws while loading (bad `at`/`hl` needle, syntax error) is reported as `failed to load: …`.
5. **Critic pass**: reread every card and item against quest-design's `references/item-checklist.md` as a learner would. Check facts against sources. Fix.
6. **Test**: `npx vitest run` (it re-validates every course and runs every kata) and `npx tsc --noEmit -p .`.
7. **Run it**: `npm run dev`, open the course, play one level end to end at phone width (≈390 px) and desktop width: step through every trace and flow, answer a few challenges, open a kata. If you can't open a browser, say so in your report. Use the Unlock all toggle on the map to reach later levels. When scripting a browser (Playwright), set `localStorage.setItem("questlog-v1", '{"unlockAll":true}')` and reload right before opening each level: the app rewrites storage on every answer and when you leave a level. Quiz options are shuffled, so pick answers by text, not position.
8. Report: files, level outline, validation and test results, and anything you could not verify.

## Common validation errors

| Message | Fix |
|---|---|
| `at: "x" matches 0 lines` / `matches 2 lines` | Pick a needle that appears on exactly one line of that `src`. |
| `hl: "x" not found` | The needle is not in the snippet; check whitespace and quotes. |
| `"X" is not one of the actors` | Flow step `from`/`to` must match an `actors` entry exactly. |
| `art "x" is not in course.art` | Add the SVG under that key or fix the key. |
| `root must not set width/height` / `no … hex colors` | Follow the art rules above. |
| `starter already passes every test` | Make the starter return a wrong default (`[]`, `{}`, `0`). |
| `solution fails "name"` | Fix the solution or the test; run the solution by hand to see the value. |
| `must look like "media/<file>" …` | `src`/`poster` must be flat `media/<file>`: no folders, scheme, leading slash or `..`. |
| `extension must be one of …` | Use an allowed extension for the block's `type` (a GIF is `type: "image"`; `poster` must be an image). |
| `only videos have a poster` | Remove `poster` from image and audio blocks. |
| `answers must be fewer than options (…)` | A `multi` needs at least one wrong option. |
| `answers must be unique` / `answers [..] but only N options` | Fix the `multi` `answers` indexes. |
| `truefalse needs exactly 2 options and 1 answer` | Use `options: ["True", "False"]` and a single answer. |
| `duplicate left item` / `duplicate right item` | Every `match` left and every right must be unique. |
| `markers must be {{1}}..{{N}} in order, once each, matching blanks` | Renumber the cloze markers to match `blanks`. |
| `"x" is not in bank` | Each cloze blank's first answer must appear in `bank`, or drop `bank`. |
| `bucket N but only M buckets` / `bucket N has no items` | Fix `sort` item bucket indexes; give every bucket an item. |
| `Unrecognized key` | A field is misspelled or does not exist; schemas are strict. |
