---
title: Export your data
---

Everything lives in one SQLite file and plain course files. Questie needs no outside service to run: without `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY` and Stripe keys it runs fully offline, with self-rated written answers.

## From the app

- Answers: Answers, Export .md.

## From the API

Signed in, in the browser or with a bearer token:

| Data | Request |
|---|---|
| Progress | `GET /api/progress` |
| Notes | `GET /api/notes` |
| Written answers (Markdown) | `GET /api/export` |
| Your AI-built courses | `GET /api/courses`, then `GET /api/courses/<id>` (course JSON) |

A course JSON validates with `npm run validate` once saved as `courses/<id>/course.json`, and edits with the MCP server or the Claude Code plugin.

## The whole database

```bash
docker exec questie node -e 'const {DatabaseSync}=require("node:sqlite");new DatabaseSync(process.env.DB_PATH).prepare("VACUUM INTO ?").run("/data/export.db")'
cp data/export.db ~/questie-export.db
```

`VACUUM INTO` writes a consistent copy while the app runs. Open it with any SQLite tool.
