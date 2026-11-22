# Questie: site, licensing, ops and mobile

Design for plan scope items 2, 9, 10 and 11 (`questie-plan.md`) and PRD sections 5.2, 5.9, 5.10, 5.11. Plan decisions are final and are not reopened here. Written 2026-11-22 against branch `questie` at `d172e33`.

Placeholders the owner fills in once: `<site-domain>` (landing + docs), `<app-domain>` (the app, e.g. `app.<site-domain>`), `<app-id>` (reverse-DNS bundle id, e.g. `com.<owner>.questie`), `<repo>` (GitHub `owner/name` after the repo rename; `chdominguez/questlog` redirects until then).

Cross-design dependencies (names other workers own; this doc uses them as written here, rename to match if they differ):

| Name | Owner | Used here for |
|---|---|---|
| `shared/pricing.ts` (the single credits/price config, CRD-6) | backend | Pricing page, RevenueCat product map |
| `/api/health` public | auth | Fly check, deploy check |
| `VITE_API_BASE` + one `apiUrl()` helper for every client fetch | mobile (this doc, section 4) | Capacitor, nothing else |
| Better Auth env (`BETTER_AUTH_*`), Stripe, RevenueCat, ElevenLabs, `ADMIN_EMAILS` | backend | Env reference (section 3.5) |
| `DB_PATH` default (`questlog.db` kept per REN-3) | rename | Litestream config |
| `plugins/questie/` (renamed from `plugins/questlog/`) | rename | REUSE paths, docs |

---

## 1. Website: Astro Starlight in `site/`

### 1.1 Layout

`site/` is its own npm project (own `package.json` and lockfile), so the root lockfile, `tsconfig.json` and the Docker image stay untouched by Astro.

```
site/
  package.json            astro, @astrojs/starlight, @fontsource/atkinson-hyperlegible, @fontsource/jetbrains-mono
  package-lock.json
  astro.config.mjs
  tsconfig.json           extends astro/tsconfigs/strict
  public/
    CNAME                 <site-domain>
    og.png                1200x630, mascot + wordmark
    demo/                 generated: static app build (1.6), gitignored
    schema/course.json    generated: JSON Schema (1.4), gitignored
  src/
    assets/               questie-light.svg, questie-dark.svg (mascot), shots/*.png (app screenshots)
    components/           Pricing.astro, CreditTable.astro, Shot.astro
    styles/questie.css    Starlight custom properties mapped to the app's tokens and fonts
    content.config.ts     docsLoader + docsSchema (Starlight default)
    content/docs/         every page, section 1.3
```

`astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://<site-domain>",
  integrations: [starlight({
    title: "Questie",
    logo: { light: "./src/assets/questie-light.svg", dark: "./src/assets/questie-dark.svg" },
    social: [{ icon: "github", label: "GitHub", href: "https://github.com/<repo>" }],
    editLink: { baseUrl: "https://github.com/<repo>/edit/main/site/" },
    customCss: ["@fontsource/atkinson-hyperlegible", "@fontsource/jetbrains-mono", "./src/styles/questie.css"],
    head: [{ tag: "meta", attrs: { property: "og:image", content: "https://<site-domain>/og.png" } }],
    lastUpdated: true,
    sidebar: [
      { label: "Learn", autogenerate: { directory: "learn" } },
      { label: "Build with AI", autogenerate: { directory: "ai" } },
      { label: "Author courses", autogenerate: { directory: "authoring" } },
      { label: "Self-host", autogenerate: { directory: "self-host" } },
      { label: "Contribute", autogenerate: { directory: "contribute" } },
      { label: "License", link: "/license/" },
    ],
  })],
  vite: { server: { fs: { allow: [".."] } } }, // pricing imports ../shared/pricing.ts
});
```

Versions: current `astro` and `@astrojs/starlight`, pinned by `site/package-lock.json`. Sitemap comes with Starlight once `site` is set. Search is Starlight's built-in Pagefind.

### 1.2 Landing page (`site/src/content/docs/index.mdx`, `template: splash`)

Audience: developers learning a language, framework or protocol, or preparing for interviews. Copy rules (from PRD WEB-5, LIC-7, CRD-13 and the owner's copy rules):

- Lead with practice a chatbot can't give: FSRS review, graded written answers, runnable katas, traces and flows, validated courses, citations. "AI course" is never the headline.
- State price and license on the page (r/Anki rule 3).
- Never write "unlimited", "beta" or a limitations section. Self-hosting is "unmetered with your own key".
- Every number matches the shipped code. Challenge types: count `ChallengeSchema` variants plus the true/false style (11 today: quiz, multi, true/false, order, bug, written, match, cloze, sort, flashcard, kata). The plan's "12" also counts drills; write "11 challenge types plus drills and arcade games" or recount at publish time.
- Short sentences, second person, outcomes first.

Sections, top to bottom:

| # | Section | Content | Copy outline |
|---|---|---|---|
| 1 | Hero (frontmatter `hero`) | Mascot image (light/dark), title, tagline, 3 actions | Title: "Courses you play. Skills that stick." Tagline: "Questie turns a topic, your notes or a repo into a course with runnable katas, graded written answers and spaced review. Open source." Actions: **Try a level** (`/demo/#/c/http-basics`, primary), **Start free** (`https://<app-domain>`), **Self-host** (`/self-host/docker/`, minimal) |
| 2 | Proof strip | One line of facts | "11 challenge types · TypeScript and Python katas · FSRS review · Answers graded by Claude · AGPL, self-hostable" |
| 3 | What a chatbot can't do | `CardGrid` of 6 cards, each with a screenshot | **Review that schedules itself**: every challenge becomes an FSRS card; misses return today, hits return in days. **Explain it, get graded**: written answers scored against key points, with the points you missed. **Code that runs**: katas with visible and hidden tests, in the browser. **Watch the code run**: step-through traces with live variables, request flows with real payloads. **Courses that pass a validator**: every AI-built course passes the same schema and kata checks as hand-written ones before you see it. **Sources on every card**: research courses link each theory card to its sources. |
| 4 | Three ways to get a course | 3 `Card`s | **Library**: free courses, reviewed before they go public. **Build with AI**: from a topic and level, from your PDFs, notes, a URL or a repo, or from web research with citations. **Write your own**: an open file format, an MCP server and a Claude Code plugin. Links to `/ai/topic/`, `/authoring/`. |
| 5 | See it | 3 large screenshots (map, trace, kata) | Captions only: "Levels unlock in order", "Step through real code", "Pass the hidden tests" |
| 6 | Practice is free | Short block | "No energy bar. No lives to refill. Games, katas, review, notes and the whole library cost nothing. Credits pay only for AI work." |
| 7 | Yours to run | 3 cards | **One container**: Docker or Fly, SQLite with continuous backups. **Your key**: bring `ANTHROPIC_API_KEY`, every AI feature runs unmetered. **Open licenses**: app AGPL-3.0, course format MIT, library courses CC-BY-4.0. Link `/license/`. |
| 8 | Pricing teaser | `Pricing.astro` compact | Free / EUR 11.99 a month / packs, link "See pricing" |
| 9 | Final CTA | 2 actions | **Try a level**, **Start free** |

Screenshots: PNGs in `site/src/assets/shots/`, taken from the demo build at 390 px and 1280 px, light and dark, rendered with Astro `<Picture>`.

### 1.3 Docs IA

All under `site/src/content/docs/`. One file per row; `.mdx` only where a component is used.

| Path | Page | Source material |
|---|---|---|
| `index.mdx` | Landing (1.2) | |
| `pricing.mdx` | Pricing (1.5), `template: splash` | `shared/pricing.ts` |
| `learn/index.md` | Start here: sign up, open a course, the map | README "What's inside" |
| `learn/levels.md` | Levels, lives, stars, XP, combos, boss | `questlog-course` SKILL "Levels" |
| `learn/challenges.md` | How each challenge plays and is graded (partial credit rules) | SKILL "Challenges", grading paragraph |
| `learn/review.md` | FSRS review queue, flashcard ratings | README, `src/engine/srs.ts` |
| `learn/katas.md` | Editor, Run vs Submit, Python via Pyodide | SKILL "Katas" |
| `learn/written.md` | Grade (2 credits) and Stronger answer + corrections (3), dictation | PRD CRD-8 |
| `learn/mock.md` | Mock exams (20 credits per session) | PRD CRD-9 |
| `learn/games.md` | Arcade games, drills, inline practice | `src/games/` |
| `learn/notes.md` | Notes, tags, notes to course | README |
| `learn/narration.md` | Narrated lessons, 10 credits once per lesson and voice | PRD NAR-* |
| `learn/credits.md` | Credits, plan vs top-ups, spend order, refunds, history | PRD section 6 |
| `learn/mobile.md` | iOS and Android apps, in-app purchases, one balance | section 4 |
| `learn/account.md` | Sign-in methods, export, delete account | PRD ACC-* |
| `ai/topic.md` | Course from a topic and level (100) | PRD BLD-1 |
| `ai/files.md` | From PDFs, notes, a URL or a repo (150) | BLD-2 |
| `ai/research.md` | From web research with citations (200) | BLD-3 |
| `ai/publish.md` | Private, link, review queue, public library | LIB-4, LIB-5 |
| `authoring/index.md` | Course anatomy, folders, `course.ts` vs `course.json`, ids are forever | SKILL "Where the files go", "File layout", "Ids" |
| `authoring/theory.md` | Every theory block kind, one section each (1.4) | schema `TheoryBlockSchema` |
| `authoring/challenges.mdx` | Every challenge type, one section each (1.4) | schema `ChallengeSchema`, `quest-design/references/challenge-types.md` |
| `authoring/katas.md` | Kata object, tests, `eq`, Python katas | `KataSchema`, SKILL "Katas" |
| `authoring/art-media.md` | Inline SVG rules, media upload and refs | `artProblem`, SKILL "Art", "media" |
| `authoring/grader-mock.md` | `grader.persona`, `mock` | SKILL "Course fields" |
| `authoring/validate.md` | `npm run validate`, the error table | SKILL "Common validation errors" |
| `authoring/reference.md` | Schema reference, generated (1.4) | `src/course/schema.ts` |
| `authoring/design.md` | Designing a good course: objectives, level mix, item checklist | `quest-design` skill + references |
| `authoring/mcp.md` | MCP server: tools, resources, Claude Code and Claude Desktop config, API token for notes | `mcp/README.md` |
| `authoring/claude-code.md` | Plugin install, the two skills, example prompts | README "Add a course", plugin skills |
| `self-host/docker.md` | VPS with Docker Compose (3.3) | |
| `self-host/fly.md` | Fly.io (3.2) | |
| `self-host/config.md` | Env reference (3.5) | |
| `self-host/backups.md` | Litestream backup and restore runbook (3.4) | |
| `self-host/upgrade.md` | Upgrading, the Questlog to Questie notes (keys, DB name, plugin reinstall, MCP URIs) | PRD REN-* |
| `self-host/export.md` | Export progress, notes, answers and courses; run with no Questie servers | LIC-8 |
| `contribute/courses.md` | Course PRs: layout, validate, DCO sign-off, CC-BY-4.0 | 2.5 |
| `contribute/code.md` | Code PRs: dev setup, tests, CLA | 2.5 |
| `license.md` | AGPL / MIT / CC-BY split, what each covers, trademark | 2 |

`mcp/README.md` shrinks to a quick start plus a link to `/authoring/mcp/`, so the tool table has one home.

### 1.4 Authoring pages and the generated schema reference

**Generated reference.** `scripts/schema-ref.ts` (root, run with the root `tsx` and `zod`) writes two files:

1. `site/public/schema/course.json`: `z.toJSONSchema(CourseSchema, { io: "input" })`, the same call `mcp/server.ts:120` uses. Served at `https://<site-domain>/schema/course.json`, so `course.json` files can set `"$schema"` and get editor completion.
2. `site/src/content/docs/authoring/reference.md`: one table per object (Course, Level, TheoryCard, each theory block kind, each challenge type, Kata, KataTest, TraceStep, FlowStep) with columns Field, Type, Required, Description. Descriptions come from the `.describe()` strings already in `schema.ts`. Discriminated unions get one sub-section per `kind` / `type` value. A closing section lists the cross-field rules from `superRefine` by hand-maintained text in the script (answer indexes, cloze markers, bucket coverage, art keys, trace lines, flow actors, unique ids).

Both outputs are gitignored and rebuilt on every site build. `scripts/schema-ref.test.ts` (picked up by the existing vitest `scripts/**` include) checks that every challenge `type` and theory `kind` appears in the Markdown, and validates every fenced block tagged `json challenge` / `json block` / `json kata` in `site/src/content/docs/authoring/*.md*` against `ChallengeSchema` / `TheoryBlockSchema` / `KataSchema`, so doc examples cannot rot.

**Theory blocks page** (`authoring/theory.md`): one section per kind with what it is for, the rules, and one example. The examples below were run through `validateCourse` together in one course and pass.

```json block
{ "kind": "md", "text": "A cache stores a response so the next request can skip the network." }
{ "kind": "code", "lang": "http", "title": "Response", "src": "HTTP/1.1 200 OK\nCache-Control: max-age=60\nETag: \"v1\"", "highlight": [2] }
{ "kind": "mermaid", "src": "sequenceDiagram\n  Browser->>Server: GET /\n  Server-->>Browser: 200 OK", "caption": "One round trip" }
{ "kind": "figure", "art": "cache", "caption": "The browser cache" }
{ "kind": "media", "type": "video", "src": "media/devtools.mp4", "alt": "DevTools shows a 304 response", "poster": "media/devtools.jpg" }
{ "kind": "trace", "lang": "ts", "src": "let n = 0;\nn = n + 2;", "steps": [{ "line": 1, "vars": { "n": "0" } }, { "line": 2, "vars": { "n": "2" }, "note": "`n` changes here." }] }
{ "kind": "flow", "actors": ["Browser", "CDN", "Origin"], "steps": [
  { "from": "Browser", "to": "CDN", "label": "GET /logo.png" },
  { "from": "CDN", "to": "Origin", "label": "miss: GET /logo.png" },
  { "from": "Origin", "to": "CDN", "label": "200 + max-age=60", "data": "HTTP/1.1 200 OK", "lang": "http" },
  { "from": "CDN", "to": "Browser", "label": "200 (cached)" }] }
{ "kind": "drill", "pairs": [{ "left": "200", "right": "OK" }, { "left": "301", "right": "Moved Permanently" }, { "left": "404", "right": "Not Found" }] }
{ "kind": "practice", "challenge": { "id": "p-max-age", "type": "quiz", "prompt": "`max-age=60` means fresh for...", "options": ["60 seconds", "60 minutes"], "answer": 0 } }
```

Each example is its own fenced block on the page; they are shown together here for review. The TS form of `trace` and `code` uses `at()` and `hl()`; the page shows both forms.

**Challenge types page** (`authoring/challenges.mdx`): one section per type with what it trains (from `quest-design/references/challenge-types.md`), fields, validation rules, grading and XP, and one example. Starlight `<Tabs>` shows the JSON and the `course.ts` form.

```json challenge
{ "id": "cache-no-cache", "type": "quiz", "prompt": "A response has `Cache-Control: no-cache`. What may the browser do with it?", "options": ["Store it, and revalidate before every reuse", "Reuse it until it expires", "Never store it"], "answer": 0, "explain": "`no-store` forbids storing. `no-cache` forces revalidation." }
{ "id": "safe-methods", "type": "multi", "prompt": "Which methods are safe?", "options": ["GET", "HEAD", "POST", "DELETE"], "answers": [0, 1] }
{ "id": "put-idempotent", "type": "multi", "style": "truefalse", "prompt": "PUT is idempotent.", "options": ["True", "False"], "answers": [0] }
{ "id": "https-order", "type": "order", "prompt": "Order the steps of a first HTTPS request.", "steps": ["DNS lookup", "TCP handshake", "TLS handshake", "HTTP request"] }
{ "id": "retry-bug", "type": "bug", "prompt": "`retry` must call `fn` at most 3 times.", "lang": "ts", "lines": ["let tries = 0;", "while (tries <= 3) {", "  if (await fn()) break;", "  tries++;", "}"], "answer": 1, "explain": "`<= 3` runs 4 times." }
{ "id": "why-etag", "type": "written", "prompt": "Why does a browser send `If-None-Match`?", "model": "To revalidate a cached copy: the server compares the ETag and answers 304 with no body when nothing changed, which saves bandwidth.", "keyPoints": ["Server compares the ETag", "304 Not Modified with no body", "Saves bandwidth"], "seconds": 120 }
{ "id": "status-match", "type": "match", "prompt": "Match each status to its meaning.", "pairs": [{ "left": "200", "right": "OK" }, { "left": "304", "right": "Not Modified" }, { "left": "404", "right": "Not Found" }] }
{ "id": "preflight-cloze", "type": "cloze", "prompt": "Complete the preflight response.", "text": "Access-Control-Allow-Origin: {{1}}\nAccess-Control-Allow-Methods: {{2}}", "blanks": [{ "answers": ["https://www.example.com"] }, { "answers": ["PUT"] }], "lang": "http" }
{ "id": "header-sort", "type": "sort", "prompt": "Request or response header?", "buckets": ["Request", "Response"], "items": [{ "text": "`If-None-Match`", "bucket": 0 }, { "text": "`Cookie`", "bucket": 0 }, { "text": "`ETag`", "bucket": 1 }, { "text": "`Set-Cookie`", "bucket": 1 }] }
{ "id": "fc-304", "type": "flashcard", "prompt": "What does `304` mean?", "back": "Not Modified: reuse your cached copy." }
{ "id": "sum-kata", "type": "kata", "prompt": "Sum a list.", "kataId": "sum" }
```

**Katas page** example (passes the solution/starter run in `validateCourse`):

```json kata
{ "id": "sum", "title": "Sum a list", "difficulty": "easy", "statement": "Return the sum of `xs`.",
  "examples": [{ "input": "[1, 2]", "output": "3" }],
  "starter": "function sum(xs: number[]): number {\n  return 0;\n}",
  "solution": "function sum(xs: number[]): number {\n  return xs.reduce((a, b) => a + b, 0);\n}",
  "complexity": "O(n) time, O(1) space.",
  "tests": [{ "name": "two", "code": "return eq(sum([1, 2]), 3)" }, { "name": "empty", "code": "return eq(sum([]), 0)" }, { "name": "negative", "code": "return eq(sum([-1, 1, 5]), 5)" }],
  "hidden": [{ "name": "one", "code": "return eq(sum([7]), 7)" }, { "name": "many", "code": "return eq(sum([1, 2, 3, 4]), 10)" }] }
```

The Python variant on the same page sets `"lang": "python"` and uses `def sum_list(xs):`.

**MCP page** (`authoring/mcp.md`): the tool table and resources from `mcp/README.md` with renamed URIs (`questie://schema/course`, `questie://guide/authoring`), the Claude Code `.mcp.json` setup, the Claude Desktop JSON with `QUESTIE_URL` and an API token for the note tools (ACC-10; the token variable name comes from the backend design), and the download-edit-reupload loop for AI-built courses (plan answer 7).

**Claude Code plugin page** (`authoring/claude-code.md`): `/plugin marketplace add <repo>`, `/plugin install questie@questie`, the `quest-design` and `questie-course` skills, three example prompts (topic, notes, repo), and the reinstall note for Questlog users.

### 1.5 Pricing page (`site/src/content/docs/pricing.mdx`, `template: splash`)

All numbers import from `shared/pricing.ts`, so the page and the app cannot disagree.

1. Hero: title "Pricing", no tagline.
2. Two plan cards (`Pricing.astro`):
   - **Free**, EUR 0: every library course; games, katas, review, notes; one AI-built course from a topic; buy top-up packs any time. Action: "Start free".
   - **Questie**, EUR 11.99 / month, VAT included: 1,000 credits every month; every AI feature; manage or cancel any time. Action: "Subscribe".
3. Top-up packs: 500 credits EUR 5.99, 1,500 credits EUR 14.99. "Top-up credits never expire."
4. Credit table (`CreditTable.astro`): action, credits, and "per month on the plan" (10 topic courses, 6 file courses, 5 research courses, 500 grades, 333 stronger answers, 50 mock exams, 100 narrated lessons).
5. Self-host card: "Run it yourself: one container, your own Anthropic key, every AI feature unmetered." Links to `/self-host/docker/`. Licenses in one line.
6. FAQ (each one a real buyer question, answered plainly): What is a credit? Do plan credits roll over? (reset each billing month; top-ups never expire; plan credits are spent first) What if an AI build fails? (refunded automatically, shown in your history) Is VAT included? Can I cancel? (yes, in the billing portal) Do app purchases share my balance? (yes, one balance on web, iOS and Android) What is always free?

### 1.6 Live demo: static app build at `/demo/`

The landing links to a demo; it does not iframe the app. The app bundle (Monaco, Mermaid, Shiki) would slow the landing page, and the live app's `guard` rejects cross-site requests anyway.

The demo is the real SPA, built static and copied into the site:

```sh
VITE_DEMO=1 vite build --base /demo/ --outDir site/public/demo --emptyOutDir
```

- Routing is hash based (`/#/c/<course>`), so it works under `/demo/`; Vite rewrites `index.html` asset URLs for the base.
- Only public courses compile in (`courses-private/` is absent in CI), so the demo holds the library (`http-basics` today).
- Progress stays in localStorage: `startSync` already fails silently without a server (`src/engine/sync.ts:26`).
- `VITE_DEMO` (one flag in `import.meta.env`) skips `startSync` and the service worker in `src/main.tsx`, hides credit-costing buttons, skips the sign-in gate the auth work adds, and sends written answers straight to self-rating. One header link: "Sign up" to `https://<app-domain>`.

Files touched in the app for the demo: `src/main.tsx`, the auth gate component, the AI buttons (via one `isDemo` export from `src/ui/` or wherever the auth work puts the platform flags).

### 1.7 Build and deploy

Root `package.json` scripts:

| Script | Command |
|---|---|
| `site:schema` | `tsx scripts/schema-ref.ts` |
| `site:demo` | `VITE_DEMO=1 vite build --base /demo/ --outDir site/public/demo --emptyOutDir` |
| `site:build` | `npm run site:schema && npm run site:demo && npm --prefix site run build` |
| `site:dev` | `npm run site:schema && npm --prefix site run dev` |

Output: `site/dist/`, fully static.

Deploy: GitHub Pages from Actions. No new account; the repo already runs Actions. `site/public/CNAME` holds `<site-domain>`.

`.github/workflows/site.yml`:

```yaml
name: Site
on:
  push: { branches: [main] }
  workflow_dispatch: {}
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm, cache-dependency-path: "package-lock.json\nsite/package-lock.json" }
      - run: npm ci && npm --prefix site ci
      - run: npm run site:build
      - uses: actions/upload-pages-artifact@v3
        with: { path: site/dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.d.outputs.page_url }}" }
    steps:
      - id: d
        uses: actions/deploy-pages@v4
```

`ci.yml` gets a `site` job running `npm ci`, `npm --prefix site ci`, `npm run site:build` on every PR (WEB-4).

---

## 2. Licensing layout

### 2.1 What is under which license

| License | Paths | Why |
|---|---|---|
| AGPL-3.0-only | Everything not listed below | The app (LIC-1) |
| MIT | `src/course/schema.ts`, `src/course/authoring.ts`, `shared/media.ts` (imported by the schema), `scripts/schema-ref.ts`, `plugins/questie/**`, `site/src/content/docs/authoring/**` | The course format: schema + authoring SDK (LIC-2). The skills and authoring docs carry the format too, and `plugin.json` already says MIT |
| CC-BY-4.0 | `courses/**` | Library courses (LIC-3) |
| Generated, inherits its source | `site/public/schema/course.json` (MIT) | JSON Schema of the format |

The format stays in place rather than moving to a separate package: several workers edit `schema.ts` in this effort (citations for research courses, for one), and a move would conflict with all of them. The paths are marked by REUSE metadata and file headers, which is what LIC-2's "clearly marked path" needs. Extracting `packages/course-format/` for npm is a later, separate change if an external consumer needs it.

### 2.2 Files

- `LICENSE`: full AGPL-3.0 text, replacing MIT (GitHub detects the repo license from it).
- `LICENSES/AGPL-3.0-only.txt`, `LICENSES/MIT.txt`, `LICENSES/CC-BY-4.0.txt`: from `reuse download --all`.
- `REUSE.toml` (REUSE 3.x; the last matching annotation wins):

```toml
version = 1

[[annotations]]
path = "**"
precedence = "closest"
SPDX-FileCopyrightText = "2026 chdominguez and contributors"
SPDX-License-Identifier = "AGPL-3.0-only"

[[annotations]]
path = ["src/course/schema.ts", "src/course/authoring.ts", "shared/media.ts", "scripts/schema-ref.ts", "plugins/questie/**", "site/src/content/docs/authoring/**", "site/public/schema/**"]
precedence = "closest"
SPDX-FileCopyrightText = "2026 chdominguez and contributors"
SPDX-License-Identifier = "MIT"

[[annotations]]
path = "courses/**"
precedence = "closest"
SPDX-FileCopyrightText = "2026 chdominguez and contributors"
SPDX-License-Identifier = "CC-BY-4.0"
```

- `NOTICE`:

```
Questie
Copyright 2026 chdominguez and contributors

The Questie app is licensed under the GNU Affero General Public License v3.0 only (LICENSE).
The course format is licensed under the MIT License (LICENSES/MIT.txt):
  src/course/schema.ts, src/course/authoring.ts, shared/media.ts, scripts/schema-ref.ts,
  plugins/questie/, site/src/content/docs/authoring/
Library courses in courses/ are licensed under CC BY 4.0 (LICENSES/CC-BY-4.0.txt).
REUSE.toml is the file-by-file record.

Bundled fonts: Atkinson Hyperlegible, JetBrains Mono, Caveat, under the SIL Open Font License 1.1.

"Questie" and the Questie mascot are trademarks of chdominguez. Forks may use the code
under its license but must not use the name or mascot for a hosted service.
```

The trademark paragraph is a recommendation; drop it if the owner does not want it.

- `README.md`: "License" section replaced by a three-line summary of the split, a link to `NOTICE` and `/license/`, plus price and license in the intro paragraph (LIC-7).
- `package.json`: `"license": "AGPL-3.0-only"`.
- `CONTRIBUTING.md`: short; how to run tests and validate, CLA for code, DCO for courses and the format, links to `/contribute/`.
- `CLA.md`: individual CLA. Contributor keeps copyright and grants the owner a perpetual, irrevocable copyright and patent license including the right to sublicense and relicense under any terms. Start from the Apache ICLA 2.2 text and add the relicensing clause. The owner reviews the final text before the workflow goes live.

### 2.3 SPDX header policy

- MIT files carry a header so copies keep their license:
  `// SPDX-License-Identifier: MIT` and `// SPDX-FileCopyrightText: 2026 chdominguez and contributors`. Markdown files in `plugins/` and `site/.../authoring/` use an HTML comment. `SKILL.md` frontmatter must stay first, so skills rely on `REUSE.toml` instead.
- AGPL and CC-BY files need no header; `REUSE.toml` covers them. No mass header commit (it would conflict with every parallel branch).
- `course.json` cannot hold comments; `REUSE.toml` covers it.
- New files under MIT paths get the header in the same commit that creates them.
- CI: `fsfe/reuse-action@v5` step in `ci.yml` (`reuse lint`) fails when a file has no license.

### 2.4 AGPL section 13 in the hosted app

Users of the hosted app must be offered the source. Add a "Source code" link on the Profile screen to `https://github.com/<repo>/tree/<commit>`, with the commit injected at build time (`VITE_COMMIT`, set from `GITHUB_SHA` in the deploy and the Docker build arg). `/api/health` also returns `commit`. Files: `src/screens/Profile.tsx`, `vite.config.ts` (define), `Dockerfile` (`ARG COMMIT`), `.github/workflows/deploy.yml`.

### 2.5 CLA and DCO enforcement

Scope rule: a PR that touches any AGPL path needs the CLA. A PR that touches `courses/**` or an MIT path needs DCO sign-off on every commit. A PR touching both needs both. The owner and bots are exempt.

Both checks run on every PR and decide inside the job, so both can be required status checks in branch protection without hanging on skipped workflows.

`.github/workflows/cla.yml`:

```yaml
name: CLA
on:
  issue_comment: { types: [created] }
  pull_request_target: { types: [opened, synchronize, reopened, closed] }
permissions: { actions: write, contents: write, pull-requests: write, statuses: write }
jobs:
  cla:
    runs-on: ubuntu-latest
    steps:
      - id: f
        if: github.event_name == 'pull_request_target'
        uses: dorny/paths-filter@v3
        with:
          predicate-quantifier: every
          filters: |
            app:
              - '**'
              - '!courses/**'
              - '!src/course/schema.ts'
              - '!src/course/authoring.ts'
              - '!shared/media.ts'
              - '!scripts/schema-ref.ts'
              - '!plugins/questie/**'
              - '!site/src/content/docs/authoring/**'
      - if: steps.f.outputs.app == 'true' || github.event.comment.body == 'recheck' || github.event.comment.body == 'I have read the CLA Document and I hereby sign the CLA'
        uses: contributor-assistant/github-action@v2.6.1
        env: { GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}" }
        with:
          path-to-signatures: signatures/cla.json
          path-to-document: https://github.com/<repo>/blob/main/CLA.md
          branch: cla-signatures
          allowlist: chdominguez,dependabot[bot]
```

`pull_request_target` runs with base-branch code and never checks out the PR, so the write token is not exposed to PR code. Signatures live on the `cla-signatures` branch; protect it from deletion.

`.github/workflows/dco.yml`:

```yaml
name: DCO
on: pull_request
jobs:
  dco:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - id: f
        uses: dorny/paths-filter@v3
        with:
          filters: |
            open: [courses/**, src/course/schema.ts, src/course/authoring.ts, shared/media.ts, scripts/schema-ref.ts, plugins/questie/**, site/src/content/docs/authoring/**]
      - if: steps.f.outputs.open == 'true' && github.event.pull_request.user.login != 'chdominguez'
        run: |
          for c in $(git rev-list --no-merges ${{ github.event.pull_request.base.sha }}..${{ github.event.pull_request.head.sha }}); do
            who=$(git show -s --format='%an <%ae>' "$c")
            git show -s --format=%B "$c" | grep -qxF "Signed-off-by: $who" || { echo "::error::$c needs 'Signed-off-by: $who' (git commit -s)"; exit 1; }
          done
```

---

## 3. Ops

### 3.1 Docker image with Litestream

`Dockerfile`:

```dockerfile
FROM litestream/litestream:0.5.<x> AS litestream

FROM node:24-bookworm-slim
WORKDIR /app
COPY --from=litestream /usr/local/bin/litestream /usr/local/bin/litestream
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG COMMIT=dev
ENV VITE_COMMIT=$COMMIT
RUN npm run build
COPY litestream.yml /etc/litestream.yml
ENV DB_PATH=/data/questlog.db HOST=0.0.0.0
EXPOSE 8787
VOLUME /data
ENTRYPOINT ["scripts/entrypoint.sh"]
```

Pin `0.5.<x>` to the newest 0.5 patch tag at implementation time, by digest. Check the binary path in that image (`docker run --rm --entrypoint sh litestream/litestream:<tag> -c 'command -v litestream'`). If the sandbox design validates Python katas server-side, it adds `python3` here.

`scripts/entrypoint.sh` (executable):

```sh
#!/bin/sh
set -e
# Without a replica configured, run the server alone (local dev, tests, self-hosters who skip backups).
if [ -z "$LITESTREAM_BUCKET" ]; then exec node dist-server/index.js; fi
litestream restore -config /etc/litestream.yml -if-db-not-exists -if-replica-exists "$DB_PATH"
exec litestream replicate -config /etc/litestream.yml -exec "node dist-server/index.js"
```

`litestream.yml` (Litestream expands `${VAR}`):

```yaml
dbs:
  - path: ${DB_PATH}
    replica:
      type: s3
      bucket: ${LITESTREAM_BUCKET}
      path: ${LITESTREAM_PATH}
      endpoint: ${LITESTREAM_ENDPOINT}
      region: ${LITESTREAM_REGION}
```

Credentials come from `LITESTREAM_ACCESS_KEY_ID` / `LITESTREAM_SECRET_ACCESS_KEY` (or `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`). Any S3-compatible store works: Tigris on Fly, Cloudflare R2, Backblaze B2, MinIO, AWS S3. With `endpoint` empty it uses AWS S3.

`server/db.ts` `openDb` sets `PRAGMA journal_mode=WAL` and `PRAGMA busy_timeout=5000` right after opening (OPS-3). No app code calls `wal_checkpoint`; Litestream owns checkpoints.

`.dockerignore` adds `site`, `ios`, `android`.

Media (`/data/media`: course media, narration audio) is files, not SQLite, so Litestream does not cover it. Narration audio can be regenerated, so the narration design re-generates on a missing file without charging. Course media is covered by Fly volume snapshots on Fly and by a host `rclone sync` on a VPS (3.4).

### 3.2 Fly (`fly.toml`)

```toml
app = "questie"
primary_region = "fra"

[build]
  [build.args]
    COMMIT = "dev"   # fly deploy --build-arg COMMIT=$(git rev-parse HEAD)

[env]
  DB_PATH = "/data/questlog.db"
  HOST = "0.0.0.0"
  PORT = "8787"
  LITESTREAM_PATH = "questie"

[[mounts]]
  source = "questie_data"
  destination = "/data"
  snapshot_retention = 14

[http_service]
  internal_port = 8787
  force_https = true
  auto_stop_machines = "off"   # reminders tick every 60 s in-process and Litestream must keep streaming
  auto_start_machines = true
  min_machines_running = 1

  [[http_service.checks]]
    method = "GET"
    path = "/api/health"
    interval = "30s"
    timeout = "5s"
    grace_period = "30s"

[[vm]]
  size = "shared-cpu-1x"
  memory = "1gb"
```

One machine, one volume, one writer (OPS-6): `fly scale count 1`. Setup: `fly launch --no-deploy --copy-config`, `fly volumes create questie_data --size 3 --region fra`, `fly storage create` (Tigris; it sets `AWS_*` and `BUCKET_NAME` secrets, then `fly secrets set LITESTREAM_BUCKET=<name> LITESTREAM_ENDPOINT=https://fly.storage.tigris.dev LITESTREAM_REGION=auto`), `fly secrets set` for the app env (3.5), `fly deploy`.

### 3.3 VPS (Docker Compose)

The existing `docker-compose.yml` stays the VPS file, keeping project and container name `questlog` until the rename work moves them (REN-4). Two changes:

```yaml
name: questlog
services:
  app:
    build: { context: ., args: { COMMIT: "${COMMIT:-dev}" } }
    container_name: questlog
    restart: unless-stopped
    ports: ["127.0.0.1:8790:8787"]
    env_file: [{ path: "${ENV_FILE:-.env}", required: false }]
    volumes: ["${DATA_DIR:-./data}:/data"]
```

- `env_file` replaces the inline `environment` map: the env list grows past 20 variables (3.5), and secrets stay in one file. The proxy-header variables go away with Better Auth (ACC-1).
- `deploy.yml` passes `ENV_FILE: ${{ env.BOX }}/.env` and `COMMIT: ${{ github.sha }}`, and its health check drops the `x-auth-request-email` header once `/api/health` is public.
- TLS: a reverse proxy in front (Caddy shown in the docs: `<app-domain> { reverse_proxy 127.0.0.1:8790 }`). No login proxy any more.
- Turning on Litestream for the live box: add the `LITESTREAM_*` vars to `$BOX/.env` and redeploy. The DB exists, so restore is skipped and replication starts with a full snapshot.

### 3.4 Backup and restore runbook (`site/.../self-host/backups.md`)

Run commands inside the container: `docker exec -it questlog sh` (VPS) or `fly ssh console` (Fly).

| Task | Command |
|---|---|
| Check replication | `litestream databases -config /etc/litestream.yml` and the server log line `replicating to: ...` |
| List restore points | `litestream ltx -config /etc/litestream.yml "$DB_PATH"` (Litestream 0.5) |
| Restore latest to a scratch file | `litestream restore -config /etc/litestream.yml -o /tmp/r.db "$DB_PATH"` |
| Point-in-time restore | `litestream restore -config /etc/litestream.yml -timestamp 2026-11-22T10:00:00Z -o /tmp/r.db "$DB_PATH"` |
| Check a restored file | `node -e 'const {DatabaseSync}=require("node:sqlite");console.log(new DatabaseSync("/tmp/r.db").prepare("PRAGMA integrity_check").get())'` |

Replace the live DB with a restored copy:

1. Stop the app (`docker compose stop` / `fly scale count 0`).
2. Move `questlog.db`, `questlog.db-wal`, `questlog.db-shm` aside (do not delete until checked).
3. Start the app. The entrypoint finds no DB and restores the latest copy. For a point in time, restore to `/tmp/r.db` first (step above from a one-off container with the same env and volume), copy it to `$DB_PATH`, then start.

Recovery drill (run once at setup and after any Litestream upgrade):

- Fly: `fly machine destroy <id> --force`, `fly volumes destroy <vol>`, `fly volumes create questie_data --size 3 --region fra`, `fly deploy`. The app comes back with its data. Sign in and open progress to confirm.
- VPS: `docker compose down`, move `data/questlog.db*` aside, `docker compose up -d`, check `/api/health` and a signed-in page.

Media:

- Fly: daily volume snapshots, 14 days (`snapshot_retention`). Restore with `fly volumes create questie_data --snapshot-id <id>`.
- VPS: host cron `rclone sync <data-dir>/media <remote>:<bucket>/media` nightly; restore with the reverse `rclone sync`.

### 3.5 Env reference (`site/.../self-host/config.md`)

"Owner" marks names another design fixes; the docs page copies the final names from server config.

| Variable | Required | Default | Purpose | Owner |
|---|---|---|---|---|
| `DB_PATH` | no | `data/questlog.db` (image: `/data/questlog.db`) | SQLite file | rename |
| `HOST`, `PORT` | no | `127.0.0.1`, `8787` | Listen address | |
| `MEDIA_DIR` | no | `media/` next to `DB_PATH` | Course media and narration audio | |
| `MEDIA_MAX_BYTES` | no | `52428800` | Largest media upload | |
| `QUESTIE_COURSES` (`QUESTLOG_COURSES` still read) | no | `courses-private` | Private course folder | rename |
| `BETTER_AUTH_SECRET` | yes | | Session signing | auth |
| `BETTER_AUTH_URL` | yes | | Public app URL, e.g. `https://<app-domain>` | auth |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no | | Google sign-in (off when unset) | auth |
| `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`, `APPLE_APP_BUNDLE_ID` | no | | Apple sign-in, web and native | auth |
| Mail transport for verification and magic links | no | | Name set by auth design | auth |
| `ADMIN_EMAILS` | no | | Comma-separated admins (review queue) | backend |
| `ANTHROPIC_API_KEY` | no | | Grading, course builder, mock exams | |
| `ELEVENLABS_API_KEY` | no | | Narration; hidden when unset | backend |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | no | | Billing; unset means billing off and AI unmetered | backend |
| `STRIPE_PRICE_PLAN`, `STRIPE_PRICE_PACK_S`, `STRIPE_PRICE_PACK_L` | with Stripe | | Price ids (test and live differ) | backend |
| `REVENUECAT_WEBHOOK_AUTH` | with mobile | | Expected `Authorization` header on the RevenueCat webhook | backend |
| `VAPID_PUBLIC`, `VAPID_PRIVATE`, `VAPID_SUBJECT` | no | | Web Push reminders | |
| `FCM_SERVICE_ACCOUNT` | with mobile | | Base64 service-account JSON for native push (4.4) | mobile |
| `LITESTREAM_BUCKET` | no | | Turns on replication | ops |
| `LITESTREAM_PATH` | no | | Key prefix in the bucket | ops |
| `LITESTREAM_ENDPOINT`, `LITESTREAM_REGION` | no | AWS | S3-compatible endpoint and region | ops |
| `LITESTREAM_ACCESS_KEY_ID`, `LITESTREAM_SECRET_ACCESS_KEY` | with bucket | | Replica credentials (`AWS_*` also read) | ops |
| `COMMIT` (build arg) | no | `dev` | Source link (2.4) | ops |

MCP-side variables (`QUESTIE_URL` and the API token) stay on the MCP page, not here.

---

## 4. Mobile: Capacitor

### 4.1 Layout

```
capacitor.config.ts
ios/                 npx cap add ios --packagemanager SPM   (committed)
android/             npx cap add android                    (committed)
resources/icon.png   1024x1024, rendered from public/icon.svg with sharp
resources/splash.png 2732x2732
src/native/
  platform.ts        isNative, apiUrl(path), the platform flags the demo also reads
  auth.ts            bearer token in secure storage; Authorization header; native Google/Apple sign-in
  purchases.ts       RevenueCat configure, logIn(userId), offerings, purchase
  push.ts            FCM token registration -> /api/push/device
```

The web app is bundled into the binary (`webDir: "dist"`); no `server.url`, so the app opens offline and passes App Store review as a real app. Origins are `capacitor://localhost` (iOS) and `https://localhost` (Android); the auth design adds both to `trustedOrigins`, the `guard` allowlist and CORS with `exposeHeaders: ["set-auth-token"]`.

Every client fetch goes through `apiUrl()` (`src/answers/api.ts`, `src/engine/sync.ts`, `src/engine/push.ts`): `${import.meta.env.VITE_API_BASE ?? ""}/api${path}`. On the web the base is empty and nothing changes. Native code is loaded with dynamic `import()` behind `isNative`, so the web bundle does not grow.

`capacitor.config.ts`:

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "<app-id>",
  appName: "Questie",
  webDir: "dist",
  plugins: {
    FirebaseMessaging: { presentationOptions: ["badge", "sound", "alert"] },
    SocialLogin: { providers: { google: true, apple: true } },
  },
};
export default config;
```

### 4.2 Dependencies (root `package.json`)

| Package | For |
|---|---|
| `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`; dev `@capacitor/cli` | Runtime and CLI |
| `@capacitor/app` | Back button, resume (refresh balance) |
| `@aparajita/capacitor-secure-storage` | Bearer token in Keychain / Keystore (MOB-2) |
| `@capgo/capacitor-social-login` | Native Google and Apple ID tokens for `signIn.social` (MOB-3) |
| `@capacitor-firebase/messaging` (+ `firebase` peer) | FCM tokens on both platforms, so the server has one native sender (MOB-5) |
| `@revenuecat/purchases-capacitor` | In-app purchases (MOB-4) |

Narration (MOB-6) uses the existing HTML `<audio>` in the WebView; no plugin. Audio URLs for private courses need the bearer header, so the narration client fetches audio as a blob with `Authorization` and plays an object URL.

### 4.3 Build scripts (root `package.json`)

| Script | Command |
|---|---|
| `build:mobile` | `VITE_API_BASE=https://<app-domain> VITE_NATIVE=1 vite build` |
| `cap:sync` | `npm run build:mobile && cap sync` |
| `cap:android` | `npm run cap:sync && cap run android` |
| `cap:ios` | `npm run cap:sync && cap open ios` |
| `cap:assets` | `npx @capacitor/assets generate --assetPath resources` |

Android release: `cd android && ./gradlew bundleRelease` with the upload keystore from env (`ANDROID_KEYSTORE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) read in `android/app/build.gradle`. iOS release: Xcode archive or `xcodebuild -exportArchive` on macOS.

Gitignored: `android/app/google-services.json`, `ios/App/App/GoogleService-Info.plist`, keystores, `android/app/build/`, `ios/App/build/`.

Native project edits (committed):

- iOS `Info.plist`: `NSMicrophoneUsageDescription` (dictation in written answers), `UIBackgroundModes: remote-notification`. Capabilities: Push Notifications, Sign in with Apple, In-App Purchase.
- Android `AndroidManifest.xml`: `POST_NOTIFICATIONS`, `RECORD_AUDIO`.

Store rules the app code must meet:

- Credits are digital goods: on native, the top-up sheet and subscribe button use RevenueCat, and Stripe Checkout and portal links are hidden (`isNative`).
- Google sign-in requires Sign in with Apple on iOS (both planned).
- Account deletion must be possible in the app: Profile gets "Delete account" (Better Auth `deleteUser`), on web too.

### 4.4 RevenueCat

Products, same ids in App Store Connect and Google Play. Credit amounts match the web (plan answer 4); store prices are the nearest store price point to the EUR web price.

| Product id | Type | Credits | Web price | Store price |
|---|---|---|---|---|
| `questie.plan.monthly` | Auto-renewing subscription, 1 month (Play base plan `monthly`; App Store group `questie`) | 1,000 per period | EUR 11.99 | nearest tier to 11.99 |
| `questie.credits.500` | Consumable | 500 | EUR 5.99 | nearest tier to 5.99 |
| `questie.credits.1500` | Consumable | 1,500 | EUR 14.99 | nearest tier to 14.99 |

RevenueCat project setup:

- Entitlement `plan`, attached to `questie.plan.monthly`.
- Offering `default`: package `$rc_monthly` -> plan; custom packages `credits_500`, `credits_1500`.
- App User ID = Better Auth user id: `Purchases.logIn(userId)` after sign-in, `logOut` on sign-out, so webhook `app_user_id` maps to the ledger user.
- Webhook: `https://<app-domain>/api/webhooks/revenuecat`, Authorization header = `REVENUECAT_WEBHOOK_AUTH`. Event handling is BIL-6.
- `shared/pricing.ts` maps product id -> credits, so the webhook, the store sheet and the pricing page read one table.
- A user with an active web subscription sees only the packs in the app, and the reverse on web, so nobody pays for the plan twice.

Native push: one Firebase project; upload the APNs auth key to Firebase so FCM also delivers to iOS. The server sends through FCM HTTP v1 with `FCM_SERVICE_ACCOUNT`, next to the existing Web Push sender. Reminders only at user-set times (MOB-7).

### 4.5 What can be verified on Linux

This machine has Node 24, Python 3.12 and Docker; no JDK or Android SDK is installed (checked 2026-11-22).

| Check | Linux | Needs |
|---|---|---|
| `npm run build:mobile`, `cap sync android` | yes | |
| `cap sync ios` (copies web assets, config, updates `Package.swift`) | yes, with the SPM project | |
| `./gradlew assembleDebug` | yes | JDK 21 + Android SDK (`sdkmanager`), or the CI job below |
| Run on Android emulator | yes | KVM + SDK emulator image |
| Bearer sign-in, API calls, narration playback on Android | yes, emulator | Debug build pointed at a reachable `VITE_API_BASE` |
| Native Google sign-in on Android | yes, emulator with Play services | OAuth Android client with the debug SHA-1 |
| FCM push on Android | yes, emulator with Play services | `google-services.json` |
| Play Billing purchases | partly | App uploaded to a Play internal test track, license tester account |
| Any iOS build, simulator, Apple sign-in, APNs, StoreKit, TestFlight | no | macOS with Xcode (owner's Mac or a `macos-latest` runner) |

The plan's "Capacitor sync works" gate runs in CI on Linux. `ci.yml` gets a `mobile` job:

```yaml
  mobile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: 21 }
      - uses: android-actions/setup-android@v3
      - run: npm ci
      - run: npm run cap:sync
      - run: cd android && ./gradlew assembleDebug
```

---

## 5. Files to create or touch

Create:

| File | Section |
|---|---|
| `site/package.json`, `site/package-lock.json`, `site/astro.config.mjs`, `site/tsconfig.json`, `site/src/content.config.ts` | 1.1 |
| `site/public/CNAME`, `site/public/og.png` | 1.1 |
| `site/src/assets/questie-light.svg`, `questie-dark.svg`, `shots/*.png` | 1.1, 1.2 |
| `site/src/styles/questie.css` | 1.1 |
| `site/src/components/Pricing.astro`, `CreditTable.astro`, `Shot.astro` | 1.2, 1.5 |
| `site/src/content/docs/**` (every page in 1.3) | 1.3 |
| `scripts/schema-ref.ts`, `scripts/schema-ref.test.ts` | 1.4 |
| `.github/workflows/site.yml`, `cla.yml`, `dco.yml` | 1.7, 2.5 |
| `LICENSES/AGPL-3.0-only.txt`, `LICENSES/MIT.txt`, `LICENSES/CC-BY-4.0.txt`, `REUSE.toml`, `NOTICE`, `CLA.md`, `CONTRIBUTING.md` | 2.2 |
| `scripts/entrypoint.sh`, `litestream.yml`, `fly.toml` | 3.1, 3.2 |
| `capacitor.config.ts`, `ios/**`, `android/**`, `resources/icon.png`, `resources/splash.png` | 4.1 |
| `src/native/platform.ts`, `auth.ts`, `purchases.ts`, `push.ts` | 4.1 |

Touch:

| File | Change | Section |
|---|---|---|
| `LICENSE` | MIT -> AGPL-3.0 text | 2.2 |
| `package.json` | `license`; `site:*`, `build:mobile`, `cap:*` scripts; Capacitor deps | 1.7, 2.2, 4.2, 4.3 |
| `README.md` | License section, price + license in intro, links to the site | 2.2 |
| `mcp/README.md` | Quick start + link to `/authoring/mcp/` | 1.3 |
| `src/course/schema.ts`, `src/course/authoring.ts`, `shared/media.ts` | MIT SPDX header only | 2.3 |
| `.gitignore` | `site/dist`, `site/node_modules`, `site/.astro`, `site/public/demo`, `site/public/schema`, `site/src/content/docs/authoring/reference.md`, native build outputs and Firebase files | 1.4, 4.3 |
| `.dockerignore` | `site`, `ios`, `android` | 3.1 |
| `.github/workflows/ci.yml` | `npm run validate`, `reuse lint`, `site` job, `mobile` job | 1.7, 2.3, 4.5 |
| `.github/workflows/deploy.yml` | `ENV_FILE`, `COMMIT`, health check without the proxy header | 2.4, 3.3 |
| `Dockerfile` | Litestream stage, entrypoint, `COMMIT` arg | 3.1 |
| `docker-compose.yml` | `env_file`, build arg; drop proxy-header env | 3.3 |
| `server/db.ts` | WAL + `busy_timeout` pragmas | 3.1 |
| `src/main.tsx` | Skip sync and service worker under `VITE_DEMO` | 1.6 |
| `src/answers/api.ts`, `src/engine/sync.ts`, `src/engine/push.ts` | Fetch through `apiUrl()` | 4.1 |
| `src/screens/Profile.tsx` | Source code link, Delete account | 2.4, 4.3 |
| `vite.config.ts` | Define `VITE_COMMIT` | 2.4 |

## 6. Verification

- `npm test` (includes `scripts/schema-ref.test.ts`), `npm run typecheck`, `npm run validate`.
- `npm run site:build` exits 0; `site/dist/index.html`, `site/dist/pricing/index.html`, `site/dist/authoring/reference/index.html`, `site/dist/schema/course.json` and `site/dist/demo/index.html` exist; open `/demo/#/c/http-basics` from `npx serve site/dist` and finish a level with no network errors other than the expected `/api` 404s.
- `reuse lint` passes.
- `docker build` then run with no `LITESTREAM_BUCKET` (server starts) and with a MinIO bucket (`docker run minio/minio`): write data, delete the volume, start again, data is back.
- `npm run cap:sync` and `./gradlew assembleDebug` in CI.
