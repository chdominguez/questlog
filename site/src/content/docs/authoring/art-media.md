---
title: Art and media
description: Inline SVG art that follows the theme, plus images, GIFs, video and audio in Questie courses.
sidebar: { order: 5 }
---

<!-- SPDX-License-Identifier: MIT -->

## Inline SVG art

`course.art` maps keys to inline SVG strings. Use a key in `level.art` (the level's node on the map) and in `figure` blocks. Art is colored with theme variables, so it looks right in light and dark mode without a second file.

```json
{
  "art": {
    "cache": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 120 120\"><circle cx=\"60\" cy=\"60\" r=\"54\" fill=\"var(--raise)\"/><rect x=\"34\" y=\"40\" width=\"52\" height=\"40\" rx=\"6\" fill=\"var(--accent)\"/></svg>"
  }
}
```

The validator enforces these rules:

- One `<svg>...</svg>` with a `viewBox` and no `width` or `height` on the root.
- Under 4 KB.
- No `href`, `url(...)`, `<image>`, `<script>`, and no hex colors.

Color with the theme variables: `var(--accent)`, `var(--accent-ink)`, `var(--ok)`, `var(--info)`, `var(--gold)`, `var(--bad)`, `var(--muted)`, `var(--fg)`, `var(--line)`, `var(--raise)`, `var(--surface)`, `var(--bg)`.

House style: `viewBox="0 0 120 120"`, a `<circle cx="60" cy="60" r="54" fill="var(--raise)"/>` backdrop, flat shapes, thick strokes, one subject that reads at 48 px, no text. Include `xmlns="http://www.w3.org/2000/svg"` on the root.

## Media files

A `media` block shows an uploaded image, GIF, video or audio file in a theory card.

```json
{ "kind": "media", "type": "image", "src": "media/devtools-304.png", "alt": "The Network panel shows a 304 for /api/menu", "caption": "Look at the Size column" }
```

| Field | Rules |
| --- | --- |
| `type` | `image`, `video` or `audio`. A GIF is an image. |
| `src` | A flat `media/<file>` ref: letters, digits, `.`, `_` and `-`, no folders. |
| `alt` | Required. What the media shows or says. |
| `caption` | Optional. Say what to watch for. |
| `poster` | Videos only: an image ref shown before playback. |

Allowed extensions:

| Type | Extensions |
| --- | --- |
| image | `png` `jpg` `jpeg` `webp` `gif` `avif` |
| video | `mp4` `webm` |
| audio | `mp3` `ogg` `m4a` `wav` |

Markdown images work too, in `md` blocks and in a challenge's `prompt` and `explain`: `![The 304 in DevTools](media/devtools-304.png)`.

### Upload first, then save

Files live in the server's media folder, not in the course folder and never in git.

1. Upload each file with the MCP tool `media_upload` (`course_id`, `filename`, and exactly one of `path` or base64 `data`; `overwrite: true` replaces a file). It returns the ref to paste into `src`.
2. Check the stored refs with `media_list`.
3. Save the course.

The validator checks the ref format; `media_list` confirms the file is there. The size cap is `MEDIA_MAX_BYTES` (50 MB by default).

### Good media

- Clips under 30 seconds, one idea each.
- An image or GIF for UI flows, video when motion or narration matters, audio for pronunciation and listening.
- The answer to any challenge is also in the text, so learners who cannot play the media still pass and review cards stand alone.
