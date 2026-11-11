import type { FlowStep, Level, TraceStep } from "questlog/authoring";
import { at, hl } from "questlog/authoring";
import { ETAG, HOST } from "../samples";

// Objectives: pick the status code for a situation; tell 401 from 403 and the redirect codes apart;
// read Cache-Control; decide whether a stored response is fresh; explain revalidation with ETag and 304.

const MENU_RESPONSE = `HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: public, max-age=600
ETag: ${ETAG}
Age: 120

[{ "id": "rye-loaf", "price": 4.5 }, { "id": "baguette", "price": 2.2 }]`;

const IS_FRESH = `function isFresh(e: Entry, now: number) {
  const cc = e.cacheControl;
  if (cc.includes("no-cache")) return false;
  const m = /max-age=(\\d+)/.exec(cc);
  if (!m) return false;
  const lifetime = Number(m[1]);
  const stored = now - e.storedAt;
  const age = e.age + stored;
  return age < lifetime;
}`;

const F = IS_FRESH;
const TRACE_FRESH: TraceStep[] = [
  {
    line: at(F, "function isFresh"),
    vars: { e: `{ cacheControl: "public, max-age=600", age: 120, storedAt: 1000 }`, now: "1300" },
    note: "Times are in seconds. The menu was stored at t=1000 with `Age: 120`, and the page asks for it again at t=1300.",
  },
  { line: at(F, "const cc ="), vars: { cc: `"public, max-age=600"` } },
  { line: at(F, `includes("no-cache")`), note: "No `no-cache`, so a stored copy may be used without asking." },
  { line: at(F, "const m ="), vars: { m: `["max-age=600", "600"]` } },
  { line: at(F, "if (!m)") },
  { line: at(F, "const lifetime ="), vars: { lifetime: "600" } },
  { line: at(F, "const stored ="), vars: { stored: "300" } },
  { line: at(F, "const age ="), vars: { age: "420" }, note: "120 s it already had in upstream caches (`Age`) + 300 s stored here." },
  { line: at(F, "return age < lifetime"), vars: { result: "true" }, note: "**Fresh**: serve it from the cache, no request at all." },
  {
    line: at(F, "function isFresh"), vars: { now: "1500", cc: "—", m: "—", lifetime: "—", stored: "—", age: "—", result: "—" },
    note: "Same entry, asked again at t=1500.",
  },
  { line: at(F, "const lifetime ="), vars: { cc: `"public, max-age=600"`, m: `["max-age=600", "600"]`, lifetime: "600" } },
  { line: at(F, "const stored ="), vars: { stored: "500" } },
  { line: at(F, "const age ="), vars: { age: "620" } },
  { line: at(F, "return age < lifetime"), vars: { result: "false" }, note: "**Stale**: the cache must check with the server before reusing it (next card)." },
];

const FLOW_REVALIDATE: FlowStep[] = [
  { from: "Page", to: "Browser cache", label: "fetch(\"/api/menu\")", lang: "ts", data: `const res = await fetch("/api/menu");` },
  {
    from: "Browser cache", to: "Browser cache", label: "isFresh → false", lang: "text",
    data: "age 620 s ≥ lifetime 600 s → stale",
    note: `The cache still has the body and its validator, \`ETag: ${ETAG}\`.`,
  },
  {
    from: "Browser cache", to: "Server", label: "conditional GET", lang: "http",
    data: `GET /api/menu HTTP/1.1
Host: ${HOST}
If-None-Match: ${ETAG}`,
  },
  {
    from: "Server", to: "Browser cache", label: "304 Not Modified", lang: "http",
    data: `HTTP/1.1 304 Not Modified
ETag: ${ETAG}
Cache-Control: public, max-age=600`,
    note: "No body: the stored copy is still right. If the menu had changed, the server would send `200 OK` with the new body and a new ETag.",
  },
  {
    from: "Browser cache", to: "Page", label: "200 from cache",
    data: `[{ "id": "rye-loaf", "price": 4.5 }, { "id": "baguette", "price": 2.2 }]`,
    note: "The cache updates the stored headers, so the copy is fresh for another 600 s. The page sees a normal `200` with the stored body.",
  },
];

const DECIDE = `flowchart TD
  A[Request] --> B{Stored copy?}
  B -- no --> N[Fetch from server]
  B -- yes --> C{Fresh?}
  C -- yes --> S[Serve stored copy]
  C -- no --> V{Has ETag or Last-Modified?}
  V -- no --> N
  V -- yes --> R[Conditional request]
  R -- 304 --> S
  R -- 200 --> U[Store and serve new copy]`;

const level: Level = {
  id: "caching",
  order: 2,
  title: "Status codes and caching",
  art: "caching",
  theory: [
    {
      title: "Five classes of status",
      blocks: [
        { kind: "figure", art: "caching" },
        {
          kind: "md",
          text: `The first digit says who should act (RFC 9110 §15):

- **1xx informational**: \`100 Continue\`, \`103 Early Hints\`.
- **2xx success**: \`200 OK\`, \`201 Created\` (with \`Location\` of the new resource), \`204 No Content\`.
- **3xx redirection**: \`301\`, \`302\`, \`307\`, \`308\` send you elsewhere; \`304 Not Modified\` says your stored copy is still good.
- **4xx client error**: \`400 Bad Request\`, \`401\`, \`403\`, \`404 Not Found\`, \`409 Conflict\`, \`429 Too Many Requests\`.
- **5xx server error**: \`500\`, \`502 Bad Gateway\`, \`503 Service Unavailable\`, \`504 Gateway Timeout\`.

A client that doesn't know a code treats it as the \`x00\` of its class.`,
        },
      ],
    },
    {
      title: "Lookalike codes",
      blocks: [
        {
          kind: "md",
          text: `| Code | Means | Example |
|---|---|---|
| 401 Unauthorized | Not authenticated: send credentials | No session cookie on \`GET /api/cart\` |
| 403 Forbidden | Authenticated or not, the answer is no | Ana is signed in but \`/api/admin/sales\` is staff-only |
| 301 / 308 | Moved **permanently** | \`http://\` → \`https://\` |
| 302 / 307 | Moved **temporarily** | Sign-in page, then back |

\`307\` and \`308\` guarantee the method and body are kept. With \`301\` and \`302\`, browsers may turn a POST into a GET for historical reasons (RFC 9110 §15.4).`,
        },
      ],
    },
    {
      title: "Cache-Control says how long",
      blocks: [
        { kind: "code", lang: "http", src: MENU_RESPONSE, title: "GET /api/menu", highlight: hl(MENU_RESPONSE, "Cache-Control", "ETag", "Age:") },
        {
          kind: "md",
          text: `Directives from RFC 9111 §5.2:
- \`max-age=600\`: fresh for 600 s after the server generated it.
- \`no-cache\`: may be stored, but must be **revalidated** with the server before every reuse.
- \`no-store\`: must **not** be stored at all.
- \`private\`: only the user's own browser may store it; \`public\`: shared caches (CDNs, proxies) may too.
- \`s-maxage\`: like \`max-age\`, for shared caches only.

\`Age: 120\` means the response already spent 120 s in caches on the way. \`ETag\` is a version tag used to revalidate.`,
        },
      ],
    },
    {
      title: "Fresh or stale?",
      blocks: [
        {
          kind: "md",
          text: "A stored response is **fresh** while its age is below its freshness lifetime (RFC 9111 §4.2). This is a simplified check: it skips `Expires`, heuristics and network delay.",
        },
        { kind: "trace", lang: "ts", src: IS_FRESH, title: "isFresh, twice", steps: TRACE_FRESH },
      ],
    },
    {
      title: "Revalidation: 304 Not Modified",
      blocks: [
        { kind: "flow", actors: ["Page", "Browser cache", "Server"], steps: FLOW_REVALIDATE, caption: "A stale menu, revalidated with its ETag" },
      ],
    },
    {
      title: "The cache's decision",
      blocks: [
        { kind: "mermaid", src: DECIDE, caption: "What a cache does with each request" },
        {
          kind: "md",
          text: "Revalidation saves the body transfer, not the round trip. Only a **fresh** copy avoids the network entirely.",
        },
      ],
    },
  ],
  challenges: [
    {
      id: "cache-created",
      type: "quiz",
      prompt: "`POST /api/orders` just created order `o-311`. Which response fits best?",
      options: [
        "`201 Created` with `Location: /api/orders/o-311`",
        "`302 Found` with `Location: /api/orders/o-311`",
        "`202 Accepted` with `Location: /api/orders/o-311`",
      ],
      answer: 0,
      explain: "`201` says a resource was created and `Location` names it. `302` would redirect the client; `202` means the work is queued and not done yet.",
    },
    {
      id: "cache-401-403",
      type: "quiz",
      prompt: "Ana is signed in, but `GET /api/admin/sales` is only for staff. What should the server answer?",
      options: ["`403 Forbidden`", "`401 Unauthorized`", "`400 Bad Request`", "`405 Method Not Allowed`"],
      answer: 0,
      explain: "She is authenticated; the answer is still no, so `403`. `401` means \"send credentials\", which wouldn't help.",
    },
    {
      id: "cache-no-cache",
      type: "quiz",
      prompt: "A response has `Cache-Control: no-cache`. What may the browser do with it?",
      options: [
        "Store it, but revalidate with the server before each reuse",
        "Reuse it without asking the server until it expires",
        "Never store it, not even for a moment",
        "Store it in memory only, never on disk",
      ],
      answer: 0,
      explain: "`no-cache` means \"check before reuse\" (RFC 9111 §5.2.2.4). Not storing at all is `no-store`.",
    },
    {
      id: "cache-304",
      type: "quiz",
      prompt: `The browser sends \`If-None-Match: ${ETAG}\` and gets \`304 Not Modified\`. What does the page's \`fetch\` receive?`,
      options: [
        "A `200` with the stored menu",
        "A `304` with an empty body",
        "An error, since 3xx is a redirect",
        "A redirect to the `Location` URL",
      ],
      answer: 0,
      explain: "The browser cache handles the 304: it refreshes the stored headers and hands the page the stored body as a normal `200`.",
    },
    {
      id: "cache-order-revalidate",
      type: "order",
      prompt: "Put the revalidation of a stale menu in order.",
      steps: [
        "The page asks for `/api/menu`",
        "The cache finds a stored copy and sees it is stale",
        `The cache sends \`GET\` with \`If-None-Match: ${ETAG}\``,
        "The server compares ETags and answers `304 Not Modified`",
        "The cache refreshes the stored headers and returns the stored body",
      ],
      explain: "Only a stale copy with a validator leads to a conditional request; a `304` lets the cache reuse the body it has.",
    },
    {
      id: "cache-bug-store",
      type: "bug",
      prompt: "This cache may keep `no-cache` responses (it revalidates them before reuse) but must **never** keep `no-store` ones. Which line is wrong?",
      lang: "ts",
      lines: [
        "function store(url: string, r: Stored) {",
        "  const cc = r.cacheControl;",
        "  if (r.status !== 200) return;",
        "  if (cc.includes(\"no-cache\")) return;",
        "  cache.set(url, r);",
        "}",
      ],
      answer: 3,
      explain: "It skips the wrong directive: `no-store` responses get stored and `no-cache` ones are dropped. Check `cc.includes(\"no-store\")`.",
    },
    {
      id: "cache-written-no-cache",
      type: "written",
      prompt: "A teammate put `Cache-Control: no-cache` on `/api/menu` \"to turn caching off\". What does it actually do, and what would you send if the data must never be stored?",
      seconds: 90,
      keyPoints: [
        "`no-cache` lets caches store the response but requires revalidation with the server before every reuse",
        "Revalidation with an ETag can return `304` and save the body transfer",
        "`no-store` forbids storing the response at all",
        "Data that must never be stored needs `no-store`",
      ],
      model: "`no-cache` doesn't turn caching off. It lets the browser and other caches store the menu, but they must check with the server before every reuse. With an ETag, that check is a conditional GET, and if nothing changed the server answers `304` and the body isn't sent again, which is useful for a menu. If the data must never be written to a cache, for example something sensitive, the directive is `no-store`, which forbids storing any part of the response.",
    },
    { id: "cache-kata", type: "kata", prompt: "Parse a `Cache-Control` header into its directives.", kataId: "parse-cache-control" },
  ],
};

export default level;
