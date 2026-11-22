# Contributing

## Run the checks

```bash
npm ci
npm test           # unit tests, courses and katas
npm run typecheck
npm run validate   # courses only, readable errors
```

Open a pull request against `main`. CI runs the same checks plus `reuse lint`.

## Sign-off

Which check applies depends on the paths a pull request touches. A pull request that touches both needs both.

- **App code** (everything under AGPL-3.0, see `REUSE.toml`): sign the [CLA](CLA.md) once. The CLA bot asks on your first pull request; reply with the sentence it gives.
- **Library courses and the course format** (`courses/`, `src/course/schema.ts`, `src/course/authoring.ts`, `shared/media.ts`, `scripts/schema-ref.ts`, `plugins/questie/`, `site/src/content/docs/authoring/`): sign off every commit under the [Developer Certificate of Origin](https://developercertificate.org/) with `git commit -s`.

New files under an MIT path start with:

```ts
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 chdominguez and contributors
```

More at [questie.app/contribute](https://questie.app/contribute/).
