# Questlog

A personal learning platform where every course is a quest. Theory cards you can step through, challenges that cost lives, katas that run in the browser, written answers graded by Claude, and spaced repetition that brings back what you missed.

Courses are plain files in git, validated by one schema, so you (or Claude) can add a new one in minutes.

## What's inside

- **Courses as maps.** Levels unlock in order. Each level is theory cards, then challenges: quiz, put-in-order, find-the-bug, written answer, coding kata. Three lives per level, up to three stars.
- **Theory that moves.** Markdown, highlighted code, Mermaid diagrams, step-through code traces with live variables, and animated request flows with real payloads.
- **Katas.** TypeScript in a Monaco editor, tests run in a Web Worker.
- **Written answers graded by Claude** against a model answer and key points, with a stronger version of your answer. Each course sets its grader persona and language.
- **Spaced repetition.** Every challenge you meet becomes an [FSRS](https://github.com/open-spaced-repetition/ts-fsrs) card. Misses come back right away, hits come back days later. One review queue across all courses.
- **XP, ranks, combo multipliers, sounds, confetti.**
- **Notes** in Markdown, tagged and linked to courses, that Claude can turn into a course.
- **Sync** across devices through a Cloudflare Worker + D1, behind Cloudflare Access.

## Run it

```bash
npm install
npm run dev        # app + API + local D1
npm test           # unit tests + every course validated, katas run
npm run validate   # just the courses, with readable errors
```

Grading needs `ANTHROPIC_API_KEY` in `.dev.vars` (see `.dev.vars.example`). Without it you rate your own answers.

## Add a course

A course is `courses/<id>/course.ts` (or `course.json`):

```ts
import { defineCourse } from "questlog/authoring";

export default defineCourse({
  id: "http-basics",
  title: "How the web talks",
  lang: "en",
  levels: [/* theory cards + challenges */],
});
```

The full contract lives in [`src/course/schema.ts`](src/course/schema.ts). `npm run validate` checks ids, answer indexes, trace lines, flow actors, art, and runs every kata's solution and starter.

Three ways to write one:

1. **With Claude Code and the skills.** Install the plugin, then ask for a course on any topic, from your notes, or from a repo:
   ```
   /plugin marketplace add chdominguez/questlog
   /plugin install questlog@questlog
   ```
   - `quest-design`: how to turn a topic into a learning quest (objectives, levels, challenge mix, item-writing rules, gamification that helps).
   - `questlog-course`: how to write, validate and ship a course in this repo.
2. **With the MCP server** (Claude Code picks up `.mcp.json`; Claude Desktop config in [`mcp/README.md`](mcp/README.md)): `course_list`, `course_get`, `course_validate`, `course_save`, `note_search`, `note_get`.
3. **By hand.** See `courses/http-basics/`.

## Private courses

Personal courses live in a separate private repo checked out at `courses-private/` (gitignored), or anywhere else with `QUESTLOG_COURSES=/path`. They load, validate and deploy exactly like public ones.

## Deploy

One Cloudflare Worker serves the app and the API.

1. `npx wrangler login`
2. `npx wrangler d1 create questlog` and put the id in `wrangler.jsonc`
3. `npx wrangler secret put ANTHROPIC_API_KEY`
4. `npm run deploy`
5. In the Cloudflare dashboard, enable Cloudflare Access on the Worker for your email, then set `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` in `wrangler.jsonc` and deploy again. The API refuses every request until Access is configured.

## License

MIT
