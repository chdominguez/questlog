---
title: MCP server
description: Let Claude list, read, validate and save Questie courses, upload media and read your notes through the Questie MCP server.
sidebar: { order: 10 }
---

<!-- SPDX-License-Identifier: MIT -->

The Questie MCP server is a local stdio server in the repo (`mcp/server.ts`). Connect it to Claude Code or Claude Desktop and Claude can work on courses with the same validator the app uses, then save them where the app loads them.

## Tools

| Tool | What it does |
| --- | --- |
| `course_list` | Every course on disk: id, title, language, level and kata counts, file, public or private. |
| `course_get(course_id)` | The full course as JSON. TypeScript courses are evaluated. |
| `course_validate(course)` | `valid`, or one problem per line: schema, cross-references and katas. |
| `course_save(course, visibility, overwrite?)` | Validates, then writes `courses/<id>/course.json` (public) or `<private root>/<id>/course.json` (private). Never replaces a `course.ts`; replaces a `course.json` only with `overwrite: true`. |
| `media_upload(course_id, filename?, data? or path?, overwrite?)` | Stores an image, GIF, video or audio file and returns the `media/<file>` ref for a `media` block or a Markdown image. Give exactly one of `data` (base64) or `path`. Upload before `course_save`. |
| `media_list(course_id)` | A course's stored media files: ref and size in bytes. |
| `note_search(query?, tag?)` | Your notes from the Questie app, without bodies. |
| `note_get(note_id)` | One note in full. |

## Resources

| URI | Content |
| --- | --- |
| `questie://schema/course` | The JSON Schema of a course, the same file served at [/schema/course.json](/schema/course.json). |
| `questie://guide/authoring` | The `questie-course` authoring guide, when the [Claude Code plugin](/authoring/claude-code/) is installed. |

These were `questlog://...` before the rename. Update any saved URIs.

## Claude Code

The repo's `.mcp.json` registers the server as `questie`. Open Claude Code in your checkout and approve it when asked.

```sh
git clone https://github.com/chdominguez/questlog.git questie
cd questie
npm install
claude
```

To use the note tools, export `QUESTIE_URL` and `QUESTIE_TOKEN` in the shell you start Claude Code from, or add an `env` block to `.mcp.json` in your own copy.

## Claude Desktop

Add this to `claude_desktop_config.json` (Settings > Developer > Edit Config) with your own paths, then restart Claude Desktop:

```json
{
  "mcpServers": {
    "questie": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/questie/mcp/server.ts"],
      "cwd": "/absolute/path/to/questie",
      "env": {
        "QUESTIE_URL": "https://app.questie.app",
        "QUESTIE_TOKEN": "your-api-key"
      }
    }
  }
}
```

`cwd` must be the repo root: course folders and the `questie/authoring` import resolve from it. If Claude Desktop cannot find `npx`, use its absolute path (`which npx`).

## Environment

| Variable | Used for |
| --- | --- |
| `QUESTIE_URL` | Base URL of your Questie app, for the note tools. `QUESTLOG_URL` is still read. |
| `QUESTIE_TOKEN` | An API key from your Questie profile, sent as `x-api-key`. It can only read notes. `QUESTLOG_TOKEN` is still read. |
| `QUESTIE_COURSES` | Private courses folder (default `courses-private`). `QUESTLOG_COURSES` is still read. |
| `MEDIA_DIR` | Where media is stored and served from (default `media/` next to the database, `DB_PATH`). |
| `MEDIA_MAX_BYTES` | Largest media upload in bytes (default 52428800, 50 MB). |

## Edit an AI-built course

Courses the AI builder makes live in your account. To change one:

1. In the app, open the course's **Share** panel and press **Download file**. You get `<id>.json`.
2. Put it in a checkout as `courses-private/<id>/course.json` and ask Claude to edit it. Claude checks every change with `course_validate`.
3. Back in the app, press **Upload new version** and pick the file. The server validates it again and keeps the course id, so your progress stays.

## Example prompts

- "List my courses and validate the private ones."
- "Read my notes tagged `postgres` and build a private course from them."
- "Add a level on cookies to `http-basics` with a flow and a bug challenge, then validate it."
