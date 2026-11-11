# Course schema reference

Human-readable version of `src/course/schema.ts` (zod). That file is the source of truth; if this page and the code disagree, the code wins. Every object is **strict**: unknown keys are errors. `(md)` = Markdown string.

For a machine-readable JSON Schema (e.g. to hand to another tool), print it from the zod schema:

```bash
npx tsx -e 'import * as z from "zod"; import { CourseSchema } from "./src/course/schema.ts"; console.log(JSON.stringify(z.toJSONSchema(CourseSchema), null, 2))'
```

The JSON Schema cannot express the cross-field checks listed under "Cross-checks"; `npm run validate` runs them.

## Course

| Field | Type | Notes |
|---|---|---|
| `id` | id | Folder name. Never change after publishing. |
| `title` | string | |
| `lang` | string ≥2 | BCP 47: `en`, `es-ES`. Used for grading, dictation, dates. |
| `summary` | string? | One line on the home screen. |
| `levels` | Level[] ≥1 | |
| `katas` | Kata[]? | Referenced by kata challenges. |
| `art` | record<string, svg>? | Inline SVG by key. |
| `grader` | `{ persona: string }`? | Who grades written answers and how strictly, in `lang`. |
| `mock` | `{ title: string, seconds: int>0 }`? | Timed exam: the boss level's written challenges, or up to 8 random written ones from all levels when the boss has none. |

**id** = `^[a-z0-9][a-z0-9-]*$` (lowercase kebab).

## Level

| Field | Type | Notes |
|---|---|---|
| `id` | id | Unique in the course. |
| `order` | number | Map position; fractions allowed. |
| `title` | string | |
| `art` | string? | Key in `course.art`; drawn on the map node. |
| `theory` | TheoryCard[] | Shown before the challenges; may be empty. |
| `challenges` | Challenge[] | Played in authored order. |
| `boss` | boolean? | Drawn last on the map. |

## TheoryCard

`{ title: string, blocks: TheoryBlock[] ≥1 }`

## TheoryBlock (by `kind`)

| kind | Fields |
|---|---|
| `md` | `text` (md) |
| `code` | `lang`, `src`, `title?`, `highlight?`: int[] (1-based; build with `hl(src, ...needles)`) |
| `mermaid` | `src`, `caption?` |
| `figure` | `art` (key in `course.art`), `caption?` |
| `trace` | `lang`, `src`, `title?`, `steps`: TraceStep[] ≥2 |
| `flow` | `actors`: string[] ≥2, `steps`: FlowStep[] ≥2, `caption?` |

**CodeLang**: `ts`, `tsx`, `js`, `json`, `bash`, `sql`, `yaml`, `http`, `python`, `text`.

**TraceStep**: `{ line: int ≥1 (build with at(src, needle)), vars?: record<string,string>, note?: md }`. `vars` holds only what changes at this step; earlier values carry forward. Values are shown verbatim.

**FlowStep**: `{ from: actor, to: actor, label: string, data?: string, lang?: CodeLang (default json), note?: md }`.

## Challenge (by `type`)

Common fields: `id` (unique across the **course**), `prompt` (md), `explain?` (md, shown after answering), `code?: { lang, src }` (snippet with the prompt; not shown for `bug` and `written`).

| type | Fields | XP | Wrong costs a life |
|---|---|---|---|
| `quiz` | `options`: md[2..6] (right one first), `answer`: 0-based index | 10 | yes |
| `order` | `steps`: md[≥3] in correct order | 15 | yes |
| `bug` | `lang`, `lines`: string[≥3], `answer`: 0-based index of the wrong line | 15 | yes |
| `written` | `model` (md), `keyPoints`: string[≥2], `seconds?`: int>0 | 25 | no (score ≥7 ok, 4–6 partial, <4 miss) |
| `kata` | `kataId`: id of a kata in `course.katas` | 40 | no (can be skipped) |

## Kata

| Field | Type | Notes |
|---|---|---|
| `id` | id | |
| `title` | string | |
| `difficulty` | `easy` \| `medium` \| `hard` | |
| `statement` | md | Every rule the tests check. |
| `examples` | `{ input, output, note? }[]` ≥1 | Strings, shown as-is. |
| `starter` | TS string | Must compile and fail ≥1 test. |
| `solution` | TS string | Must pass every test. |
| `complexity` | md | |
| `tests` | KataTest[] ≥3 | Visible (Run). |
| `hidden` | KataTest[] ≥2 | Extra on Submit. |

**KataTest**: `{ name: string, code: string }`. `code` is JavaScript run after the user's code and must `return eq(got, expected)`. `eq` is deep equality (NaN equals NaN; Map/Set order-insensitive). `console.log` output is shown to the learner. `export` is stripped before running.

## Art

`artProblem(svg)` rejects an SVG that:
- is not a single `<svg …>…</svg>`;
- has no `viewBox` on the root, or sets `width`/`height` on the root;
- is 4096 bytes or more;
- contains `href`, `url(`, `<image`, `<script`, or a hex color like `#fff`.

Theme variables: `--accent`, `--accent-ink`, `--ok`, `--info`, `--gold`, `--bad`, `--muted`, `--fg`, `--line`, `--raise`, `--surface`, `--bg`.

## Cross-checks (run by `npm run validate`)

- Duplicate level, challenge or kata ids.
- `level.art` and `figure.art` exist in `course.art`; every art entry passes `artProblem`.
- Trace step `line` and code `highlight` within the snippet.
- Flow `from`/`to` are actors.
- Quiz/bug `answer` within range.
- `kataId` exists.
- Each kata: solution passes all tests; starter compiles and fails at least one.

## Authoring helpers (`questlog/authoring`)

- `defineCourse(c)`: identity, type-checks a course object.
- `hl(src, ...needles)`: sorted 1-based lines containing any needle; throws on a needle that matches nothing.
- `at(src, needle)`: the single 1-based line containing `needle`; throws on 0 or >1 matches.
- Types: `CourseInput`, `Level`, `TheoryCard`, `TheoryBlock`, `TraceStep`, `FlowStep`, `Challenge`, `Kata`, `KataTest`.
