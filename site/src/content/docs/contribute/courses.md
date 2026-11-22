---
title: Contribute a course
description: Add a course to the Questie library with a pull request, signed off under the DCO and published under CC BY 4.0.
sidebar: { order: 1 }
---

Library courses are free for every Questie learner, on the hosted app and on every self-hosted copy. Add yours with a pull request.

## 1. Write it

Fork the repo and add your course under `courses/<id>/`, where `<id>` is the course id. Follow [Course anatomy](/authoring/) and [Designing a course](/authoring/design/). The [Claude Code plugin](/authoring/claude-code/) and the [MCP server](/authoring/mcp/) do most of the work.

Library courses are general topics, safe to publish: no personal notes, no employer details, no private data. Use reserved example data such as `example.com`, `203.0.113.0/24` and `555-` phone numbers.

## 2. Check it

```sh
npm ci
npm run validate <id>
npm test
npm run typecheck
```

Then play one level end to end with `npm run dev`, at phone and desktop width. See [Validate and test](/authoring/validate/).

## 3. Sign off every commit

Courses, the course format and the authoring docs use the [Developer Certificate of Origin](https://developercertificate.org/). It states that you wrote the change, or have the right to submit it, under the project's license. Sign off each commit with `-s`:

```sh
git commit -s -m "Add a course on HTTP caching"
```

This adds a `Signed-off-by: Your Name <you@example.com>` line matching your git author. The DCO check fails a pull request when a commit is missing it. To fix earlier commits:

```sh
git rebase --signoff main
git push --force-with-lease
```

## 4. Open the pull request

CI validates every course, runs every kata and checks licensing with `reuse lint`. A reviewer reads the course for accuracy and teaching quality, then merges it. After the next deploy it is in the library.

## License

Library courses are published under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): anyone may share and adapt them, with credit. By signing off, you license your course under it. You keep your copyright.

A pull request that also changes app code needs the [CLA](/contribute/code/#the-cla) as well.

## Publishing from the app

Built a course with AI in the app? You can submit it to the library from its **Share** panel instead. See [Share and publish](/ai/publish/).
