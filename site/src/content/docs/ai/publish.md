---
title: Share and publish
description: Keep an AI-built Questie course private, share it by link right away, or submit it to the public library through the review queue.
sidebar:
  order: 4
---

Every course you build is yours. Keep it private, send a link to a friend or a study group, or submit it to the public library so every Questie learner can play it.

## Course status

| Status | Who can open it | Shown as |
|---|---|---|
| Private | Only you | `Private` |
| Link | Anyone with the link, signed in | `Link` |
| In review | Anyone with the link, while an admin reviews it | `In review` |
| In library | Everyone, listed in the **Library** | `In library` |
| Rejected | Anyone with the link; the reason is shown to you | `Rejected` |

New courses start private. Your courses on **Courses** show their status as a pill.

## Share by link

1. Open your course map and press **Share**.
2. Press **Copy link**. The course becomes `Link` and the link is on your clipboard.

The link works right away. Anyone who opens it signs in (a free account is enough) and plays the course on its map. It also shows up on their other devices.

## Submit to the library

1. In **Share**, press **Submit to library**.
2. Confirm **Submit to library?** Library courses are published under CC BY 4.0.
3. The course moves to `In review`. Your link keeps working the whole time.

An admin reviews the course. Once approved, it shows as `In library` and appears in the **Library** under **Community**, with your name as the author. Research courses carry a **Cited** tag.

If the course is rejected, the reason appears under the `Rejected` pill. Fix what it says, then press **Submit again**.

## Make it private again

Press **Make private** in **Share** and confirm. The course goes back to `Private` and shared links stop working.

## Edit your course

Questie courses are plain files, so you edit them with the same tools course authors use.

1. In **Share**, press **Download file** to get the course as JSON.
2. Edit it with the [MCP server](/authoring/mcp/) or the [Claude Code plugin](/authoring/claude-code/), or by hand following the [schema reference](/authoring/reference/).
3. Press **Upload new version** and pick the file.

Questie validates the file and shows **Course updated**, or lists what to fix under **Invalid course**. Progress on challenges you kept is preserved. A course that was `In library` goes back to review after an update.

## Report a problem

Spotted a mistake in any course? Press the flag on a theory card or challenge, pick **Wrong**, **Unclear**, **Broken** or **Other**, add details and press **Send**. Reports go to the admins with the review queue.

## Good to know

- Library courses are free for every user.
- When you delete your account, your courses are deleted too, including the ones in the library.
- Want to contribute a course to the main library on GitHub? See [Contribute a course](/contribute/courses/).
