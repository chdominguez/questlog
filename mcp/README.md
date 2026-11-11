# Questlog MCP server

A local stdio MCP server that lets Claude list, read, validate and create courses, and read your notes from the deployed app. Run it by hand with `npm run mcp`.

## Tools

| Tool | What it does |
| --- | --- |
| `course_list` | Every course on disk: id, title, lang, level and kata counts, file, public or private |
| `course_get(course_id)` | The full course as JSON (TypeScript courses are evaluated) |
| `course_validate(course)` | `valid`, or one problem per line (schema, cross-references, katas) |
| `course_save(course, visibility, overwrite?)` | Validates, then writes `courses/<id>/course.json` (public) or `<private root>/<id>/course.json` (private). Never replaces a `course.ts`; replaces a `course.json` only with `overwrite: true` |
| `note_search(query?, tag?)` | Your notes from the deployed app, without bodies |
| `note_get(note_id)` | One note in full |

Resources: `questlog://schema/course` (JSON Schema of a course) and `questlog://guide/authoring` (the `questlog-course` skill, when installed).

## Environment

| Variable | Used for |
| --- | --- |
| `QUESTLOG_COURSES` | Private courses folder (default `courses-private`) |
| `QUESTLOG_URL` | Base URL of the deployed app, for the note tools |
| `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` | Cloudflare Access service token, if the app is behind Access |

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
        "CF_ACCESS_CLIENT_ID": "...",
        "CF_ACCESS_CLIENT_SECRET": "..."
      }
    }
  }
}
```

`cwd` must be the repo root: course folders and the `questlog/authoring` import in TypeScript courses resolve from it. If Claude Desktop cannot find `npx`, use its absolute path (`which npx`).
