import type { Kata } from "questlog/authoring";

const kata: Kata = {
  id: "parse-cache-control",
  title: "Parse Cache-Control",
  difficulty: "medium",
  statement: `Write \`parseCacheControl(header)\` for the value of a \`Cache-Control\` header. Return an object with one entry per directive (RFC 9111 §5.2):

- Directives are separated by commas; trim spaces and skip empty ones.
- Names are case-insensitive: store them **lowercase**.
- \`name=value\` stores the value as a string (case kept). If the value is wrapped in double quotes, drop the quotes.
- A directive without \`=\` stores \`true\`.
- A comma **inside double quotes** does not separate directives: \`private="Set-Cookie, Authorization"\` is one directive.
- If a directive appears twice, keep the **first** one.`,
  examples: [
    { input: `"max-age=600, must-revalidate"`, output: `{ "max-age": "600", "must-revalidate": true }` },
    { input: `"No-Store"`, output: `{ "no-store": true }` },
    { input: `'private="Set-Cookie, Authorization", max-age=0'`, output: `{ private: "Set-Cookie, Authorization", "max-age": "0" }` },
  ],
  starter: `function parseCacheControl(header: string): Record<string, string | true> {
  // your code
  return {};
}
`,
  solution: `function parseCacheControl(header: string): Record<string, string | true> {
  const parts: string[] = [];
  let cur = "", quoted = false;
  for (const ch of header) {
    if (ch === '"') quoted = !quoted;
    if (ch === "," && !quoted) { parts.push(cur); cur = ""; } else cur += ch;
  }
  parts.push(cur);

  const out: Record<string, string | true> = {};
  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    const i = part.indexOf("=");
    const name = (i < 0 ? part : part.slice(0, i)).trim().toLowerCase();
    if (Object.hasOwn(out, name)) continue;
    let value: string | true = true;
    if (i >= 0) {
      value = part.slice(i + 1).trim();
      if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    }
    out[name] = value;
  }
  return out;
}
`,
  complexity: "**O(n)** time and space in the header length. RFC 9111 §4.2.1 lets a cache either use the first of two conflicting `max-age` directives, as here, or treat the response as stale.",
  tests: [
    { name: "Value and flag", code: `return eq(parseCacheControl("max-age=600, must-revalidate"), { "max-age": "600", "must-revalidate": true })` },
    { name: "Lowercase names", code: `return eq(parseCacheControl("No-Store"), { "no-store": true })` },
    { name: "Messy spacing", code: `return eq(parseCacheControl("public,max-age=60 ,  s-maxage=300"), { public: true, "max-age": "60", "s-maxage": "300" })` },
  ],
  hidden: [
    { name: "Empty header", code: `return eq(parseCacheControl(""), {})` },
    { name: "Comma inside quotes", code: `return eq(parseCacheControl('private="Set-Cookie, Authorization", max-age=0'), { private: "Set-Cookie, Authorization", "max-age": "0" })` },
    { name: "First duplicate wins", code: `return eq(parseCacheControl("max-age=60, MAX-AGE=0"), { "max-age": "60" })` },
    { name: "Empty directives", code: `return eq(parseCacheControl(", ,no-cache,"), { "no-cache": true })` },
  ],
};

export default kata;
