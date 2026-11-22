---
title: Contribute code
description: Set up Questie for development, run the checks, and sign the CLA for app code.
sidebar: { order: 2 }
---

Questie is a React and Vite app with a Node and Hono server on SQLite, in one repo.

## Set up

Use Node 24.

```sh
git clone https://github.com/chdominguez/questlog.git questie
cd questie
npm ci
cp .env.example .env    # add ANTHROPIC_API_KEY for grading and AI courses
npm run server          # API on :8787, SQLite in data/
npm run dev             # app on :5173, proxies /api
```

| Folder | What lives there |
| --- | --- |
| `src/` | The app: screens, the game engine, katas, games, billing and auth screens |
| `server/` | The API: auth, credits, billing webhooks, the AI builder, grading, narration, library |
| `shared/` | Types and config used by both, including `shared/pricing.ts` |
| `courses/` | Library courses |
| `mcp/` | The MCP server |
| `plugins/questie/` | The Claude Code plugin |
| `site/` | This website (Astro Starlight) |

## Run the checks

```sh
npm test            # unit tests, every course validated, every kata run
npm run typecheck
npm run validate    # courses only, readable errors
npm run site:build  # this website, the schema reference and the demo
```

Tests never call paid services: Stripe, RevenueCat, Anthropic, ElevenLabs, Resend and FCM are faked in tests. Keep it that way.

## Open a pull request

Open it against `main`. CI runs the same checks plus `reuse lint`. Keep changes small and focused, follow the patterns around the code you touch, and include a test for new logic.

## The CLA

App code (everything under AGPL-3.0) needs a one-time Contributor License Agreement. You keep your copyright. You grant the maintainer a license to use your contribution, including the right to relicense it. Read the full text in [CLA.md](https://github.com/chdominguez/questlog/blob/main/CLA.md).

To sign, comment on your first pull request:

```text
I have read the CLA Document and I hereby sign the CLA
```

The CLA bot records your GitHub account and the date. One signature covers all your future pull requests.

| Your pull request touches | You need |
| --- | --- |
| App code | The CLA |
| `courses/`, the course format or the authoring docs | DCO sign-off on every commit (`git commit -s`), see [Contribute a course](/contribute/courses/) |
| Both | Both |

## New files

New files under an MIT path (the course format, the plugin, the authoring docs) start with an SPDX header:

```ts
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 chdominguez and contributors
```

Everything else is covered by `REUSE.toml`. See [License](/license/) for the full split.
