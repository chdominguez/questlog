# Questie

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
- **Sync** across devices through the self-hosted server (Node + SQLite), with built-in sign-in (email, Google, Apple). Each account has its own progress, answers and notes.

## Run it

```bash
npm install
npm run server     # API on :8787 (SQLite in data/)
npm run dev        # app on :5173, proxies /api
npm test           # unit tests + every course validated, katas run
npm run validate   # just the courses, with readable errors
```

The server needs `APP_URL` and `BETTER_AUTH_SECRET` (`openssl rand -hex 32`); `npm start` reads them from `.env` (start from `.env.example`). Grading and the course builder need `ANTHROPIC_API_KEY`; without it you rate your own answers. Every variable: [questie.app/self-host/config](https://questie.app/self-host/config/).

## Add a course

A course is `courses/<id>/course.ts` (or `course.json`):

```ts
import { defineCourse } from "questie/authoring";

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
   /plugin install questie@questie
   ```
   Coming from the old `questlog` plugin: run `/plugin uninstall questlog@questlog` and `/plugin marketplace remove questlog`, then the two commands above.
   - `quest-design`: how to turn a topic into a learning quest (objectives, levels, challenge mix, item-writing rules, gamification that helps).
   - `questie-course`: how to write, validate and ship a course in this repo.
2. **With the MCP server** (Claude Code picks up `.mcp.json`; Claude Desktop config in [`mcp/README.md`](mcp/README.md)): `course_list`, `course_get`, `course_validate`, `course_save`, `media_upload`, `media_list`, `note_search`, `note_get`.
3. **By hand.** See `courses/http-basics/`.

## Private courses

Personal courses live in a separate private repo checked out at `courses-private/` (gitignored), or anywhere else with `QUESTIE_COURSES=/path` (`QUESTLOG_COURSES` is still read). They load, validate and deploy exactly like public ones.

## Deploy

One container serves the app and the API, with SQLite on the `/data` volume and optional [Litestream](https://litestream.io) replication to any S3-compatible bucket.

```bash
docker compose up -d --build   # http://127.0.0.1:8790, env from .env
fly deploy                     # Fly.io, see fly.toml
```

Put TLS in front (Caddy: `app.example.com { reverse_proxy 127.0.0.1:8790 }`). Sign-in is built in; no login proxy. Set `LITESTREAM_BUCKET` and its keys to stream every write to the bucket; on start the container restores the database when the volume is empty. Guides: [Docker](https://questie.app/self-host/docker/), [Fly](https://questie.app/self-host/fly/), [config](https://questie.app/self-host/config/), [backups](https://questie.app/self-host/backups/), [upgrading from Questlog](https://questie.app/self-host/upgrade/).

Every push to `main` redeploys through `.github/workflows/deploy.yml` on a self-hosted runner on the host.

First deploy after the rename (owner box):

1. Add `APP_URL`, `BETTER_AUTH_SECRET` and the other new vars to `$BOX/.env`. Drop `USER_HEADER`, `NAME_HEADER`, `LOGOUT_URL`.
2. Caddy reaches the container on the `frontend` network. The container is now `questie`: point Caddy at `questie:8787`, or add `aliases: [questlog]` under `frontend` in `$BOX/docker-compose.override.yml`. Remove the oauth2-proxy `forward_auth` for the app.
3. Merge. The workflow brings the old `questlog` project down, then starts `questie` on the same port and volume (`questlog.db` keeps its name).
4. Later, to rename the runner: relabel the host runner `questie` first, then change `runs-on` in `deploy.yml`.

## License

- The app: [AGPL-3.0-only](LICENSE).
- The course format (`src/course/schema.ts`, `src/course/authoring.ts`, `shared/media.ts`, `plugins/questie/`): [MIT](LICENSES/MIT.txt).
- Library courses in `courses/`: [CC BY 4.0](LICENSES/CC-BY-4.0.txt).

Details in [`NOTICE`](NOTICE), [`REUSE.toml`](REUSE.toml) and [questie.app/license](https://questie.app/license/). Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md).
