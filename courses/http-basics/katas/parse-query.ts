import type { Kata } from "questlog/authoring";

const kata: Kata = {
  id: "parse-query",
  title: "Parse a query string",
  difficulty: "easy",
  statement: `Write \`parseQuery(qs)\` for the part of a URL after \`?\`, as a browser form would send it (\`application/x-www-form-urlencoded\`). Return an object that maps each name to **all** its values, in order.

Rules:
- Ignore one leading \`?\`.
- Pairs are separated by \`&\`; skip empty pairs.
- Split each pair at the **first** \`=\`. A pair without \`=\` has the value \`""\`.
- In names and values, turn \`+\` into a space, then percent-decode (\`decodeURIComponent\`).`,
  examples: [
    { input: `"?category=bread&page=2"`, output: `{ category: ["bread"], page: ["2"] }` },
    { input: `"tag=rye&tag=seeded"`, output: `{ tag: ["rye", "seeded"] }`, note: "Repeated names keep every value" },
    { input: `"q=rye+%26+spelt"`, output: `{ q: ["rye & spelt"] }` },
  ],
  starter: `function parseQuery(qs: string): Record<string, string[]> {
  // your code
  return {};
}
`,
  solution: `function parseQuery(qs: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const decode = (s: string) => decodeURIComponent(s.replace(/\\+/g, " "));
  for (const pair of qs.replace(/^\\?/, "").split("&")) {
    if (!pair) continue;
    const i = pair.indexOf("=");
    const name = decode(i < 0 ? pair : pair.slice(0, i));
    const value = i < 0 ? "" : decode(pair.slice(i + 1));
    (out[name] ??= []).push(value);
  }
  return out;
}
`,
  complexity: "**O(n)** time and space in the length of the string. In real code, `new URLSearchParams(qs)` does exactly this; `getAll(name)` returns every value.",
  tests: [
    { name: "Two pairs", code: `return eq(parseQuery("?category=bread&page=2"), { category: ["bread"], page: ["2"] })` },
    { name: "Repeated name", code: `return eq(parseQuery("tag=rye&tag=seeded"), { tag: ["rye", "seeded"] })` },
    { name: "Plus and percent", code: `return eq(parseQuery("q=rye+%26+spelt"), { q: ["rye & spelt"] })` },
  ],
  hidden: [
    { name: "Empty string", code: `return eq(parseQuery(""), {})` },
    { name: "Missing = and empty value", code: `return eq(parseQuery("?flag&x="), { flag: [""], x: [""] })` },
    { name: "Split at the first =", code: `return eq(parseQuery("a=1=2"), { a: ["1=2"] })` },
    { name: "Empty pairs", code: `return eq(parseQuery("&&a=1&"), { a: ["1"] })` },
    { name: "UTF-8 name and value", code: `return eq(parseQuery("%C3%B1=%F0%9F%8D%9E"), { "ñ": ["🍞"] })` },
  ],
};

export default kata;
