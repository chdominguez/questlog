# Questlog

A personal learning platform where every course is a quest. Theory cards you can step through, challenges that cost lives, katas that run in the browser, written answers graded by Claude, and spaced repetition that brings back what you missed.

Courses are plain files in git, validated by one schema, so you (or Claude) can add a new one in minutes.

## What's inside

- **Courses as maps.** Levels unlock in order. Each level is theory cards, then challenges: quiz, multi-select and true/false, match, cloze, sort, flashcard, put-in-order, find-the-bug, written answer, coding kata. Three lives per level, up to three stars.
- **Theory that moves.** Markdown, highlighted code, Mermaid diagrams, step-through code traces with live variables, animated request flows with real payloads, and images, GIFs, video and audio.
- **Katas.** TypeScript in a Monaco editor, tests run in a Web Worker.
- **Written answers graded by Claude** against a model answer and key points, with a stronger version of your answer. Each course sets its grader persona and language.
- **Spaced repetition.** Every challenge you meet becomes an [FSRS](https://github.com/open-spaced-repetition/ts-fsrs) card. Misses come back right away, hits come back days later. One review queue across all courses.
- **XP, ranks, combo multipliers, sounds, confetti.**
- **Notes** in Markdown, tagged and linked to courses, that Claude can turn into a course.
- **Sync** across devices through the self-hosted server (Node + SQLite), behind your login proxy. Each user (the proxy header) has separate progress, answers and notes.

## Run it

```bash
npm install
npm run server     # API on :8787 (SQLite in data/)
npm run dev        # app on :5173, proxies /api
npm test           # unit tests + every course validated, katas run
npm run validate   # just the courses, with readable errors
```

Grading needs `ANTHROPIC_API_KEY` in `.env` (see `.env.example`). Without it you rate your own answers.

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
2. **With the MCP server** (Claude Code picks up `.mcp.json`; Claude Desktop config in [`mcp/README.md`](mcp/README.md)): `course_list`, `course_get`, `course_validate`, `course_save`, `media_upload`, `media_list`, `note_search`, `note_get`.
3. **By hand.** See `courses/http-basics/`.

## Private courses

Personal courses live in a separate private repo checked out at `courses-private/` (gitignored), or anywhere else with `QUESTLOG_COURSES=/path`. They load, validate and deploy exactly like public ones.

## Deploy

One container serves the app and the API, with SQLite on the `/data` volume.

```bash
docker compose up -d --build   # http://127.0.0.1:8790
```

Put a login proxy (e.g. Caddy + oauth2-proxy + Keycloak) in front. It must remove any client-sent user header and set it to the signed-in user (`USER_HEADER`, default `x-auth-request-email`; `NAME_HEADER` carries the display name). Set `LOGOUT_URL` to the proxy's sign-out URL (for oauth2-proxy + Keycloak: `/oauth2/sign_out?rd=` the realm's end-session URL) to show Sign out on the profile. The proxy must skip login for `/manifest.webmanifest`, `/sw.js`, `/favicon.svg` and `/icons/*`, or installing and the service worker break on the redirect. Study reminders need `VAPID_PUBLIC`, `VAPID_PRIVATE` and `VAPID_SUBJECT` (`npx web-push generate-vapid-keys`); on iOS they work from the installed home-screen app (16.4+). The port is published on localhost only. Import old answers with `npx tsx scripts/import-answers.ts <file> --course <id> --user <email>`.

Every push to `main` redeploys through `.github/workflows/deploy.yml` on a self-hosted runner on the host.

## License

MIT
