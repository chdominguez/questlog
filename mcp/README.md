# Questlog MCP server

A local stdio MCP server that lets Claude list, read, validate and create courses, upload course media, and read your notes from the deployed app. Run it by hand with `npm run mcp`.

## Tools

| Tool | What it does |
| --- | --- |
| `course_list` | Every course on disk: id, title, lang, level and kata counts, file, public or private |
| `course_get(course_id)` | The full course as JSON (TypeScript courses are evaluated) |
| `course_validate(course)` | `valid`, or one problem per line (schema, cross-references, katas) |
| `course_save(course, visibility, overwrite?)` | Validates, then writes `courses/<id>/course.json` (public) or `<private root>/<id>/course.json` (private). Never replaces a `course.ts`; replaces a `course.json` only with `overwrite: true` |
| `media_upload(course_id, filename?, data? \| path?, overwrite?)` | Stores an image, GIF, video or audio file (png jpg jpeg webp gif avif mp4 webm mp3 ogg m4a wav, up to `MEDIA_MAX_BYTES`) and returns the `media/<file>` ref for a course's `media` block or Markdown image. Give exactly one of `data` (base64) or `path`. Upload before `course_save` |
| `media_list(course_id)` | The stored media files of a course: ref and size in bytes |
| `note_search(query?, tag?)` | Your notes from the deployed app, without bodies |
| `note_get(note_id)` | One note in full |

Resources: `questlog://schema/course` (JSON Schema of a course) and `questlog://guide/authoring` (the `questlog-course` skill, when installed).

## Environment

| Variable | Used for |
| --- | --- |
| `QUESTLOG_COURSES` | Private courses folder (default `courses-private`) |
| `MEDIA_DIR` | Where media is stored and served from (default `media/` next to the database, `DB_PATH`) |
| `MEDIA_MAX_BYTES` | Largest media upload in bytes (default 52428800, 50 MB) |
| `QUESTLOG_URL` | Base URL of the deployed app, for the note tools |
| `QUESTLOG_HEADERS` | JSON of headers to send, e.g. the user header a login proxy trusts (`{"x-auth-request-email":"me@x.com"}`) |

## Claude Code

The repo's `.mcp.json` registers the server as `questlog`; open Claude Code in the repo and approve it. To give it the note variables, export them in the shell you start Claude Code from, or add an `env` block to `.mcp.json` in your own copy.

## Claude Desktop

Add this to `claude_desktop_config.json` (Settings > Developer > Edit Config), with your own path, then restart Claude Desktop:

```json
{
  "mcpServers": {
    "questlog": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/questlog/mcp/server.ts"],
      "cwd": "/absolute/path/to/questlog",
      "env": {
        "QUESTLOG_URL": "https://questlog.example.com",
        "QUESTLOG_HEADERS": "{\"x-auth-request-email\":\"me@example.com\"}"
      }
    }
  }
}
```

`cwd` must be the repo root: course folders and the `questlog/authoring` import in TypeScript courses resolve from it. If Claude Desktop cannot find `npx`, use its absolute path (`which npx`).
