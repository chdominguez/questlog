import type { FlowStep, Level } from "questlog/authoring";
import { hl } from "questlog/authoring";
import { HOST, IP } from "../samples";

// Objectives: name the parts of a URL and know which one stays in the browser; order the steps of loading a page;
// read a request and a response; tell safe and idempotent methods apart; build a query string safely; parse one.

const URL_PARTS = `https://${HOST}:443/menu?category=bread&page=2#specials

scheme    https
host      ${HOST}
port      443
path      /menu
query     category=bread&page=2
fragment  specials`;

const REQUEST = `GET /menu?category=bread HTTP/1.1
Host: ${HOST}
User-Agent: Mozilla/5.0 (X11; Linux x86_64)
Accept: text/html
Accept-Language: en-GB,en;q=0.8
`;

const RESPONSE = `HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 5120
Cache-Control: max-age=60

<!doctype html>
<title>Menu: bread</title>
<link rel="stylesheet" href="/styles.css">
…`;

const ENCODE = `const term = "rye & spelt";

"/api/menu?q=" + term;
// "/api/menu?q=rye & spelt"     → q is "rye ", plus a stray " spelt"

"/api/menu?" + new URLSearchParams({ q: term, page: "1" });
// "/api/menu?q=rye+%26+spelt&page=1"   → q is "rye & spelt"`;

const FLOW_LOAD: FlowStep[] = [
  {
    from: "Browser", to: "DNS resolver", label: `A? ${HOST}`, lang: "text",
    data: `;; QUESTION SECTION
${HOST}.            IN  A`,
    note: "The browser (through the OS) first needs an IP address for the host.",
  },
  {
    from: "DNS resolver", to: "Browser", label: `A ${IP}`, lang: "text",
    data: `;; ANSWER SECTION
${HOST}.     300  IN  A  ${IP}`,
    note: "TTL 300: the answer may be reused for 5 minutes without asking again.",
  },
  {
    from: "Browser", to: "Server", label: "TCP + TLS handshake", lang: "text",
    data: `TCP  SYN → SYN-ACK → ACK                     ${IP}:443
TLS  ClientHello  server_name=${HOST}  alpn=[h2, http/1.1]
     ServerHello  alpn=http/1.1   certificate for ${HOST}`,
    note: "`server_name` (SNI) tells the server which site's certificate to present. The browser checks the certificate before sending anything else.",
  },
  {
    from: "Browser", to: "Server", label: "GET /menu?category=bread", lang: "http", data: REQUEST,
    note: "The address bar said `…#specials`, but the fragment is not in the request.",
  },
  { from: "Server", to: "Browser", label: "200 OK (HTML)", lang: "http", data: RESPONSE },
  {
    from: "Browser", to: "Server", label: "GET /styles.css", lang: "http",
    data: `GET /styles.css HTTP/1.1
Host: ${HOST}
Accept: text/css,*/*;q=0.1`,
    note: "It can reuse the same TCP connection: HTTP/1.1 keeps connections open by default.",
  },
  {
    from: "Server", to: "Browser", label: "200 OK (CSS)", lang: "http",
    data: `HTTP/1.1 200 OK
Content-Type: text/css
Cache-Control: max-age=31536000, immutable`,
  },
];

const level: Level = {
  id: "requests",
  order: 1,
  title: "Requests and responses",
  art: "requests",
  theory: [
    {
      title: "Anatomy of a URL",
      blocks: [
        { kind: "figure", art: "requests", caption: "A request goes out, a response comes back" },
        { kind: "code", lang: "text", src: URL_PARTS, title: "One URL, six parts", highlight: hl(URL_PARTS, "fragment") },
        {
          kind: "md",
          text: "The browser uses the **host** to find the server (port 443 is the default for `https`, so URLs usually leave it out) and puts the **path and query** in the request. The **fragment** (`#specials`) never leaves the browser: it only tells the page where to scroll or what to show.",
        },
      ],
    },
    {
      title: "From address bar to page",
      blocks: [
        { kind: "flow", actors: ["Browser", "DNS resolver", "Server"], steps: FLOW_LOAD, caption: `Loading https://${HOST}/menu?category=bread#specials` },
      ],
    },
    {
      title: "The request",
      blocks: [
        { kind: "code", lang: "http", src: REQUEST, title: "Request message", highlight: hl(REQUEST, "GET /menu", "Host:") },
        {
          kind: "md",
          text: `- **Request line**: method, request target (path + query), protocol version.
- **Header fields**: one \`Name: value\` per line. Names are case-insensitive.
- **Host** is mandatory in HTTP/1.1: one IP can serve many sites, and a server must answer \`400 Bad Request\` when it is missing (RFC 9112 §3.2).
- An empty line ends the headers; a body may follow (not for this GET).

HTTP/2 and HTTP/3 encode the same fields in binary frames; the meaning is the same (RFC 9110).`,
        },
      ],
    },
    {
      title: "The response",
      blocks: [
        { kind: "code", lang: "http", src: RESPONSE, title: "Response message", highlight: hl(RESPONSE, "200 OK", "Content-Type") },
        {
          kind: "md",
          text: `- **Status line**: version, status code, reason phrase. Clients act on the **code**; the phrase is for humans.
- **Content-Type** says how to read the body: here HTML in UTF-8.
- **Content-Length** is the body size in bytes.
- **Cache-Control** says how long the response may be reused (next level).`,
        },
      ],
    },
    {
      title: "Safe and idempotent methods",
      blocks: [
        {
          kind: "md",
          text: `| Method | Safe | Idempotent | Typical use |
|---|---|---|---|
| GET | yes | yes | Read \`/menu\` |
| HEAD | yes | yes | Headers of \`/menu\`, no body |
| PUT | no | yes | Replace cart \`c-1042\` with this one |
| DELETE | no | yes | Remove cart \`c-1042\` |
| POST | no | no | Place a new order |
| PATCH | no | no | Change part of cart \`c-1042\` |

- **Safe**: the client asks for no change on the server (RFC 9110 §9.2.1).
- **Idempotent**: sending it twice has the same intended effect as sending it once (§9.2.2).

Why it matters: after a timeout the client can't tell whether the server acted. It may resend an idempotent request; resending a POST can place a second order.`,
        },
      ],
    },
    {
      title: "Query strings need encoding",
      blocks: [
        { kind: "code", lang: "ts", src: ENCODE, title: "Building /api/menu?q=…", highlight: hl(ENCODE, "+ term", "URLSearchParams") },
        {
          kind: "md",
          text: "`&`, `=`, `#`, `+` and spaces mean something in a query. Encode every value with `URLSearchParams` or `encodeURIComponent` before you put it in a URL. On the way in, servers decode `+` as a space and `%26` as `&`.",
        },
      ],
    },
  ],
  challenges: [
    {
      id: "req-fragment",
      type: "quiz",
      prompt: `The address bar shows \`https://${HOST}/menu?category=bread#specials\`. Which part does the server **never** receive?`,
      options: ["`#specials`", "`?category=bread`", `\`${HOST}\``, "`/menu`"],
      answer: 0,
      explain: `The fragment stays in the browser. The query is part of the request target, and the host travels in the \`Host\` header (and in TLS as SNI).`,
    },
    {
      id: "req-host",
      type: "quiz",
      prompt: "An HTTP/1.1 request arrives with no `Host` header. What must the server do?",
      options: [
        "Answer `400 Bad Request`",
        "Serve the default site on that IP",
        "Use its own IP address as the host",
        "Redirect with `301` to a full URL",
      ],
      answer: 0,
      explain: "RFC 9112 §3.2 requires `Host` in every HTTP/1.1 request and a `400` when it is missing. Guessing a default site was HTTP/1.0 behavior.",
    },
    {
      id: "req-content-type",
      type: "quiz",
      prompt: "A response body arrives as bytes. Which header tells the browser to read them as HTML in UTF-8?",
      options: [
        "`Content-Type: text/html; charset=utf-8`",
        "`Accept: text/html`",
        "`Content-Encoding: utf-8`",
        "`Content-Length: 5120`",
      ],
      answer: 0,
      explain: "`Content-Type` describes the body. `Accept` is what the client asked for, and `Content-Encoding` is compression such as `gzip`, not the character set.",
    },
    {
      id: "req-idempotent",
      type: "quiz",
      prompt: "A request times out and the client can't tell whether the server acted. Which one can it resend without risking a second effect?",
      options: [
        "`PUT /api/cart/c-1042` with the full cart",
        "`POST /api/orders` with the cart",
        "`POST /api/cart/c-1042/items` with one loaf",
        "`PATCH /api/cart/c-1042` adding one loaf",
      ],
      answer: 0,
      explain: "PUT replaces the cart with the same state each time, so it is idempotent. POST and this PATCH add something on every call.",
    },
    {
      id: "req-order-load",
      type: "order",
      prompt: `Put the first visit to \`https://${HOST}/menu?category=bread\` in order.`,
      steps: [
        `Resolve \`${HOST}\` to an IP address with DNS`,
        "Open a TCP connection to port 443",
        "Run the TLS handshake and check the certificate",
        "Send `GET /menu?category=bread` with a `Host` header",
        "Receive `200 OK` with the HTML",
        "Parse the HTML and request `/styles.css`",
      ],
      explain: "Name → connection → encryption → request → response → subresources. HTTPS needs the TLS handshake before any HTTP bytes are sent.",
    },
    {
      id: "req-bug-encode",
      type: "bug",
      prompt: "`searchMenu(\"rye & spelt\")` must search for the whole phrase. Which line breaks that?",
      lang: "ts",
      lines: [
        "async function searchMenu(q: string) {",
        "  const url = \"/api/menu?q=\" + q;",
        "  const res = await fetch(url);",
        "  if (!res.ok) return [];",
        "  return res.json();",
        "}",
      ],
      answer: 1,
      explain: "The raw `&` splits the query: the server sees `q=\"rye \"` and a stray parameter `\" spelt\"`. Use `\"/api/menu?\" + new URLSearchParams({ q })`.",
    },
    {
      id: "req-written-retry",
      type: "written",
      prompt: "Your checkout client resends requests that time out. Explain which requests it may resend automatically, and why.",
      seconds: 90,
      keyPoints: [
        "After a timeout the client can't know whether the server already applied the request",
        "Idempotent methods (GET, HEAD, PUT, DELETE) are safe to resend: repeating them has the same intended effect",
        "POST and PATCH are not idempotent: resending can place a second order or apply a change twice",
        "To resend a POST safely, make it idempotent, e.g. with a client-generated key the server deduplicates",
      ],
      model: "A timeout doesn't tell the client whether the server acted, so the only safe requests to resend blindly are idempotent ones. GET and HEAD don't change anything, and PUT and DELETE set the same final state no matter how many times they run: putting cart c-1042 twice leaves the same cart. POST and PATCH are different. Resending `POST /api/orders` can place two orders. If the checkout must retry a POST, I'd make it idempotent: the client sends a unique key with the order and the server stores it, so a repeat with the same key returns the first result instead of creating a new order.",
    },
    { id: "req-kata-query", type: "kata", prompt: "Parse a query string the way a server does.", kataId: "parse-query" },
  ],
};

export default level;
