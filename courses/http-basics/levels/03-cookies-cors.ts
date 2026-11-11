import type { FlowStep, Level } from "questlog/authoring";
import { hl } from "questlog/authoring";
import { API, HOST, ORIGIN, SID } from "../samples";

// Objectives: read Set-Cookie attributes; tell same-origin from same-site; predict when a preflight happens;
// configure CORS for credentialed requests; walk through a full cross-origin request (interleaves levels 1-2).

const COOKIE = `HTTP/1.1 204 No Content
Set-Cookie: sid=${SID}; Domain=example.com; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=3600

GET /api/cart HTTP/1.1
Host: ${HOST}
Cookie: sid=${SID}`;

const CORS_HEADERS = `const ALLOWED = new Set(["${ORIGIN}"]);

function corsHeaders(origin: string) {
  if (!ALLOWED.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}`;

const CART = `{"items":[{"id":"rye-loaf","qty":2}]}`;

const FLOW_PREFLIGHT: FlowStep[] = [
  {
    from: "Page", to: "Browser", label: "fetch PUT, credentials", lang: "ts",
    data: `await fetch("https://${API}/cart/c-1042", {
  method: "PUT",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ items: [{ id: "rye-loaf", qty: 2 }] }),
});`,
    note: `The page is at \`${ORIGIN}\`; the API is another origin.`,
  },
  {
    from: "Browser", to: "API", label: "OPTIONS (preflight)", lang: "http",
    data: `OPTIONS /cart/c-1042 HTTP/1.1
Host: ${API}
Origin: ${ORIGIN}
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: content-type`,
    note: "A PUT with a JSON body is not a simple request, so the browser asks first. The preflight carries no cookies and no body.",
  },
  {
    from: "API", to: "Browser", label: "204 + Allow-* headers", lang: "http",
    data: `HTTP/1.1 204 No Content
Access-Control-Allow-Origin: ${ORIGIN}
Access-Control-Allow-Methods: GET, PUT, DELETE
Access-Control-Allow-Headers: content-type
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 600
Vary: Origin`,
    note: "`Max-Age: 600` lets the browser skip this preflight for the next 10 minutes.",
  },
  {
    from: "Browser", to: "API", label: "PUT /cart/c-1042", lang: "http",
    data: `PUT /cart/c-1042 HTTP/1.1
Host: ${API}
Origin: ${ORIGIN}
Content-Type: application/json
Cookie: sid=${SID}

${CART}`,
    note: "The cookie goes along: `Domain=example.com` covers the API host, and `www` and `api` are the same site, so `SameSite=Lax` allows it.",
  },
  {
    from: "API", to: "Browser", label: "200 + CORS headers", lang: "http",
    data: `HTTP/1.1 200 OK
Content-Type: application/json
Access-Control-Allow-Origin: ${ORIGIN}
Access-Control-Allow-Credentials: true
Vary: Origin

{"id":"c-1042","items":[{"id":"rye-loaf","qty":2}],"total":9}`,
  },
  {
    from: "Browser", to: "Page", label: "response readable",
    data: `{"id":"c-1042","items":[{"id":"rye-loaf","qty":2}],"total":9}`,
    note: "Without the CORS headers on **this** response too, the PUT would still have run on the server, but the page could not read the result.",
  },
];

const level: Level = {
  id: "cookies-cors",
  order: 3,
  title: "Cookies and CORS",
  art: "cookies-cors",
  boss: true,
  theory: [
    {
      title: "Cookies carry state",
      blocks: [
        { kind: "figure", art: "cookies-cors" },
        { kind: "code", lang: "http", src: COOKIE, title: "Sign-in response, then the next request", highlight: hl(COOKIE, "Set-Cookie", "Cookie: sid") },
        {
          kind: "md",
          text: "HTTP itself is stateless. To remember Ana, the server sets a cookie once and the browser sends it back on every matching request (RFC 6265).",
        },
      ],
    },
    {
      title: "Cookie attributes",
      blocks: [
        {
          kind: "md",
          text: `| Attribute | Effect |
|---|---|
| \`Secure\` | Sent over HTTPS only |
| \`HttpOnly\` | Hidden from JavaScript (\`document.cookie\`) |
| \`SameSite=Strict\` | Sent only on same-site requests |
| \`SameSite=Lax\` | Same-site requests, plus top-level navigations with safe methods (clicking a link to the site) |
| \`SameSite=None\` | Sent cross-site too; requires \`Secure\` |
| \`Domain=example.com\` | Sent to \`example.com\` and its subdomains; without \`Domain\`, only to the exact host that set it |
| \`Max-Age\` / \`Expires\` | Lifetime; without them the cookie is deleted when the browser session ends |`,
        },
      ],
    },
    {
      title: "Same origin, same site",
      blocks: [
        {
          kind: "md",
          text: `**Origin** = scheme + host + port. **Site** = scheme + registrable domain (\`example.com\`), ports ignored.

Compared with \`${ORIGIN}\`:

| URL | Same origin? | Same site? |
|---|---|---|
| \`${ORIGIN}/cart\` | yes | yes |
| \`https://${API}\` | no: host | yes |
| \`http://${HOST}\` | no: scheme | no: scheme |
| \`${ORIGIN}:8443\` | no: port | yes |
| \`https://example.org\` | no | no |

Browsers let a page read responses only from its own origin, unless the other origin allows it with **CORS**. \`SameSite\` cookies use the **site** boundary.`,
        },
      ],
    },
    {
      title: "Preflight",
      blocks: [
        { kind: "flow", actors: ["Page", "Browser", "API"], steps: FLOW_PREFLIGHT, caption: `${ORIGIN} updates a cart on https://${API}` },
      ],
    },
    {
      title: "Simple requests skip the preflight",
      blocks: [
        {
          kind: "md",
          text: `A cross-origin request goes out **without** a preflight when it is:
- \`GET\`, \`HEAD\` or \`POST\`, and
- only sets CORS-safelisted headers (such as \`Accept\`, \`Accept-Language\`, \`Content-Language\`, \`Content-Type\`), and
- has a \`Content-Type\` of \`application/x-www-form-urlencoded\`, \`multipart/form-data\` or \`text/plain\`.

Anything else (\`PUT\`, \`DELETE\`, JSON bodies, an \`Authorization\` header) is preflighted.

CORS is enforced **by the browser**. \`curl\` or another server ignores it, and a simple request reaches the server either way. CORS decides who may **read** responses in a browser; the API still needs its own authentication and CSRF defenses.`,
        },
      ],
    },
    {
      title: "Credentials need an exact origin",
      blocks: [
        { kind: "code", lang: "ts", src: CORS_HEADERS, title: "API: CORS headers", highlight: hl(CORS_HEADERS, "Allow-Origin", "Vary") },
        {
          kind: "md",
          text: "With `credentials: \"include\"`, the browser rejects `Access-Control-Allow-Origin: *`: the response must name the exact origin and send `Access-Control-Allow-Credentials: true` (Fetch standard). `Vary: Origin` stops caches from serving one origin's answer to another.",
        },
      ],
    },
  ],
  challenges: [
    {
      id: "cors-httponly",
      type: "quiz",
      prompt: "Which `Set-Cookie` attribute stops a script injected into the page from reading `sid` through `document.cookie`?",
      options: ["`HttpOnly`", "`Secure`", "`SameSite=Strict`", "`Path=/api`"],
      answer: 0,
      explain: "`HttpOnly` hides the cookie from JavaScript. `Secure` only limits it to HTTPS, and `SameSite` limits cross-site sending, not reading.",
    },
    {
      id: "cors-same-origin",
      type: "quiz",
      prompt: `The page is at \`${ORIGIN}/menu\`. Which URL is **same-origin**?`,
      options: [`\`${ORIGIN}/api/cart\``, `\`https://${API}/cart\``, `\`http://${HOST}/api/cart\``, `\`${ORIGIN}:8443/api/cart\``],
      answer: 0,
      explain: "Origin is scheme + host + port, all three equal. `api.example.com` is the same **site** but a different origin.",
    },
    {
      id: "cors-preflight",
      type: "quiz",
      prompt: `Which call from \`${ORIGIN}\` to \`https://${API}/cart\` triggers a preflight?`,
      options: [
        "`fetch(url, { method: \"POST\", headers: { \"Content-Type\": \"application/json\" }, body })`",
        "`fetch(url, { method: \"POST\", headers: { \"Content-Type\": \"text/plain\" }, body })`",
        "`fetch(url, { method: \"GET\", headers: { \"Accept\": \"application/json\" } })`",
      ],
      answer: 0,
      explain: "`application/json` is not a safelisted content type, so that POST is preflighted. `text/plain` POSTs and GETs with `Accept` are simple requests.",
    },
    {
      id: "cors-samesite-none",
      type: "quiz",
      prompt: "A cookie must be sent on requests made from a partner's site (cross-site). Which attributes does it need?",
      options: ["`SameSite=None; Secure`", "`SameSite=None` alone", "`SameSite=Lax; Secure`", "`HttpOnly; Secure`"],
      answer: 0,
      explain: "Only `SameSite=None` allows cross-site sending, and browsers reject `SameSite=None` without `Secure`. `Lax` blocks cross-site subrequests.",
    },
    {
      id: "cors-curl",
      type: "quiz",
      prompt: `A script on a server runs \`curl -X DELETE https://${API}/cart/c-1042\`. What does CORS do?`,
      options: ["Nothing; only browsers enforce CORS", "The API's CORS headers block it", "It fails because `Origin` is missing"],
      answer: 0,
      explain: "CORS is a browser rule about who may read responses. Outside a browser it does nothing, so the API must check authentication itself.",
    },
    {
      id: "cors-bug-wildcard",
      type: "bug",
      prompt: "The page calls the API with `credentials: \"include\"`, and the browser refuses to hand the response to the page. Which line causes it?",
      lang: "ts",
      lines: [
        "function corsHeaders(origin: string) {",
        "  if (!ALLOWED.has(origin)) return {};",
        "  return {",
        "    \"Access-Control-Allow-Origin\": \"*\",",
        "    \"Access-Control-Allow-Credentials\": \"true\",",
        "    \"Vary\": \"Origin\",",
        "  };",
        "}",
      ],
      answer: 3,
      explain: "With credentials, `*` is rejected. Echo the checked origin: `\"Access-Control-Allow-Origin\": origin`.",
    },
    {
      id: "cors-written-cart-cache",
      type: "written",
      prompt: "`GET /api/cart` returns Ana's cart, chosen by her `sid` cookie. A CDN sits in front of the API. Which `Cache-Control` would you send, and why?",
      seconds: 90,
      keyPoints: [
        "The response is per-user, so shared caches like the CDN must not store it",
        "`private` lets only Ana's browser store it (or `no-store` if it must never be stored)",
        "`public` or `s-maxage` would let the CDN serve Ana's cart to other users",
        "If the browser may reuse it, pair a short `max-age` or `no-cache` with an ETag so it revalidates",
      ],
      model: "The cart depends on Ana's cookie, so it's per-user and must never sit in a shared cache. If the CDN stored it, the next person asking for `/api/cart` could get Ana's cart. I'd send `Cache-Control: private`, which lets only her browser keep it, and I'd add `no-cache` with an ETag so the browser checks before reusing it and gets a cheap `304` when nothing changed. If the cart were sensitive enough that it shouldn't be written anywhere, I'd use `no-store` instead.",
    },
    {
      id: "cors-written-walkthrough",
      type: "written",
      prompt: `The page at \`${ORIGIN}\` runs \`fetch("https://${API}/cart/c-1042", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body })\` for the first time. Walk through what goes over the wire and what the API must send back.`,
      seconds: 120,
      keyPoints: [
        "The browser first sends an OPTIONS preflight with `Origin`, `Access-Control-Request-Method: PUT` and `Access-Control-Request-Headers: content-type`",
        "The preflight response must allow the exact origin (not `*`), the method and the header, plus `Access-Control-Allow-Credentials: true`",
        "Then the browser sends the PUT with the `sid` cookie, because `www` and `api` are the same site and the cookie's domain covers the API",
        "The PUT response also needs `Access-Control-Allow-Origin` and `Allow-Credentials`, or the page can't read it",
        "PUT is idempotent, so resending it after a timeout is safe",
      ],
      model: "The API is a different origin and the request is a PUT with JSON, so the browser first sends an OPTIONS preflight with `Origin: https://www.example.com`, `Access-Control-Request-Method: PUT` and `Access-Control-Request-Headers: content-type`, without cookies. The API has to answer with `Access-Control-Allow-Origin` set to that exact origin, since credentials rule out `*`, allow PUT and content-type, and send `Allow-Credentials: true`. Then the browser sends the real PUT with the `sid` cookie: www and api are the same site and the cookie is set for example.com. The PUT response needs the same two CORS headers or the page can't read the cart. And since PUT is idempotent, the client can safely resend it if it times out.",
    },
  ],
};

export default level;
