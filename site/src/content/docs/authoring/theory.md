---
title: Theory blocks
description: Every theory block kind in a Questie course, with the rules and a working example for each.
sidebar: { order: 2 }
---

<!-- SPDX-License-Identifier: MIT -->

A level opens with theory cards. Each card has a `title`, a list of `blocks`, an optional `tip` that Questie says when the card opens, and optional `sources` (citations shown under the card).

```json
{
  "title": "Cache-Control says how long",
  "tip": "`no-cache` still caches. It just asks first.",
  "blocks": [{ "kind": "md", "text": "A cache stores a response so the next request can skip the network." }],
  "sources": [{ "url": "https://www.rfc-editor.org/rfc/rfc9111", "title": "RFC 9111: HTTP Caching" }]
}
```

`kind` picks the block. There are nine. Every example on this page passes the validator, and the test suite checks that they keep passing.

Keep code lines short. A phone shows about 35 characters before a snippet scrolls sideways, so aim for 40 characters or fewer per line in `code` and `trace` blocks.

## md

Markdown prose. Keep it short: a few sentences, a list or a table.

```json block
{ "kind": "md", "text": "A cache stores a response so the next request can skip the network." }
```

## code

A static excerpt with syntax highlighting. `highlight` marks 1-based lines. `lang` is one of `ts`, `tsx`, `js`, `json`, `bash`, `sql`, `yaml`, `http`, `python`, `text`.

```json block
{ "kind": "code", "lang": "http", "title": "Response", "src": "HTTP/1.1 200 OK\nCache-Control: max-age=60\nETag: \"v1\"", "highlight": [2] }
```

In a `course.ts`, compute highlights with `hl()`. It throws when a needle is missing, so an edit to the snippet cannot silently drop a highlight.

```ts
import { hl } from "questie/authoring";

const RESPONSE = `HTTP/1.1 200 OK
Cache-Control: max-age=60
ETag: "v1"`;

const block = { kind: "code", lang: "http", title: "Response", src: RESPONSE, highlight: hl(RESPONSE, "Cache-Control") };
```

## mermaid

A Mermaid diagram: sequence, flowchart or state. Keep labels short.

```json block
{ "kind": "mermaid", "src": "sequenceDiagram\n  Browser->>Server: GET /\n  Server-->>Browser: 200 OK", "caption": "One round trip" }
```

## figure

An illustration from the course's `art` map, with an optional caption. See [Art and media](/authoring/art-media/) for the SVG rules.

```json block
{ "kind": "figure", "art": "cache", "caption": "The browser cache" }
```

## media

An uploaded image, GIF, video or audio file. `alt` is required and says what the media shows or says. A GIF is `"type": "image"`. Only videos take a `poster`.

```json block
{ "kind": "media", "type": "video", "src": "media/devtools.mp4", "alt": "DevTools shows a 304 response", "poster": "media/devtools.jpg" }
```

Upload the file first, then reference it. See [Art and media](/authoring/art-media/#media-files).

## trace

A step-through run of code. The learner steps forward and back while the current line lights up and the variables update. Each step names the 1-based `line` about to run, the `vars` that change at that step (earlier values carry forward), and an optional `note`.

```json block
{ "kind": "trace", "lang": "ts", "src": "let n = 0;\nn = n + 2;", "steps": [{ "line": 1, "vars": { "n": "0" } }, { "line": 2, "vars": { "n": "2" }, "note": "`n` changes here." }] }
```

Values are display strings, so quote strings yourself: `{ "status": "\"stale\"" }`. Compute them by running the code, never by guessing.

In a `course.ts`, take each line number from `at()`. It throws unless exactly one line matches the needle.

```ts
import { at } from "questie/authoring";
import type { TraceStep } from "questie/authoring";

const SRC = `let n = 0;
n = n + 2;`;

const steps: TraceStep[] = [
  { line: at(SRC, "let n"), vars: { n: "0" } },
  { line: at(SRC, "n + 2"), vars: { n: "2" }, note: "`n` changes here." },
];
```

## flow

A request hopping between actors, with the payload at each hop. List `actors` left to right in the order the request first reaches them. Every step's `from` and `to` is an actor; the same actor on both ends is a self-call. `data` is the payload, shown as JSON unless `lang` says otherwise. Keep labels under about 28 characters and flows to 4 to 9 hops.

```json block
{ "kind": "flow", "actors": ["Browser", "CDN", "Origin"], "steps": [
  { "from": "Browser", "to": "CDN", "label": "GET /logo.png" },
  { "from": "CDN", "to": "Origin", "label": "miss: GET /logo.png" },
  { "from": "Origin", "to": "CDN", "label": "200 + max-age=60", "data": "HTTP/1.1 200 OK", "lang": "http" },
  { "from": "CDN", "to": "Browser", "label": "200 (cached)" }] }
```

## drill

A matching game that reinforces the table or list right above it. The learner matches one pair, then two, then three, adding one new pair each round, then all of them. 3 to 12 pairs, unique lefts and unique rights. Drills are practice: they cost no lives and are not recorded.

```json block
{ "kind": "drill", "pairs": [{ "left": "200", "right": "OK" }, { "left": "301", "right": "Moved Permanently" }, { "left": "404", "right": "Not Found" }] }
```

## practice

An ungraded challenge inside the card, right after the block it reinforces. The type is one of `quiz`, `multi`, `order`, `match`, `sort` or `cloze`. Practice costs no lives and is not recorded, but its id must still be unique among the course's challenges.

```json block
{ "kind": "practice", "challenge": { "id": "p-max-age", "type": "quiz", "prompt": "`max-age=60` means fresh for...", "options": ["60 seconds", "60 minutes"], "answer": 0 } }
```

Good pairings: a `cloze` over the key lines of a template, an `order` for a process, a `sort` for a categorization, a `quiz` for one key fact.

## Sources

Research courses cite their sources on each card. A source is a `url` (http or https) and a `title`. The AI builder accepts only URLs that came out of its research, so every link on a research card points at a page the research actually cited.
