import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { ChallengeSchema, KataSchema, TheoryBlockSchema, formatIssues } from "../src/course/schema";
import { validateCourse } from "../src/course/validate";
import { courseJsonSchema, renderReference } from "./schema-ref";

const DOCS = resolve(import.meta.dirname, "../site/src/content/docs/authoring");
const SCHEMAS = { challenge: ChallengeSchema, block: TheoryBlockSchema, kata: KataSchema } as const;
type Tag = keyof typeof SCHEMAS;

/** Every ```json challenge|block|kata fence in the authoring docs, with where it came from. */
const fences = readdirSync(DOCS).filter((f) => /\.mdx?$/.test(f) && f !== "reference.md").flatMap((f) =>
  [...readFileSync(resolve(DOCS, f), "utf8").matchAll(/^\s*```json (challenge|block|kata)[^\n]*\n([\s\S]*?)^\s*```/gm)]
    .map((m) => ({ where: `${f}: ${m[2].slice(0, 60)}`, tag: m[1] as Tag, value: JSON.parse(m[2]) as Record<string, any> })));

test("reference lists every challenge type and theory block kind", () => {
  const md = renderReference();
  for (const o of ChallengeSchema.options) expect(md).toContain(`### ${o.shape.type.value}\n`);
  for (const o of TheoryBlockSchema.options) expect(md).toContain(`### ${o.shape.kind.value}\n`);
  expect(courseJsonSchema()).toMatchObject({ type: "object", required: expect.arrayContaining(["id", "levels"]) });
});

test("authoring docs show every challenge type, block kind and both kata languages", () => {
  const of = (tag: Tag, key: string) => new Set(fences.filter((f) => f.tag === tag).map((f) => f.value[key]));
  expect([...of("challenge", "type")].sort()).toEqual(ChallengeSchema.options.map((o) => o.shape.type.value).sort());
  expect([...of("block", "kind")].sort()).toEqual(TheoryBlockSchema.options.map((o) => o.shape.kind.value).sort());
  expect(of("kata", "lang")).toEqual(new Set([undefined, "python"]));
});

test.each(fences.map((f) => [f.where, f] as const))("example validates: %s", (_, f) => {
  const r = SCHEMAS[f.tag].safeParse(f.value);
  expect(r.success ? "" : formatIssues(r.error)).toBe("");
});

test("all examples together form a valid course, katas included", () => {
  const pick = (tag: Tag) => fences.filter((f) => f.tag === tag).map((f) => f.value);
  const blocks = pick("block");
  const art = Object.fromEntries(blocks.filter((b) => b.kind === "figure").map((b) =>
    [b.art, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="var(--raise)"/></svg>']));
  const course = {
    id: "docs", title: "Docs examples", lang: "en", art, katas: pick("kata"),
    levels: [{ id: "all", order: 1, title: "All", theory: [{ title: "Blocks", blocks }], challenges: pick("challenge") }],
  };
  expect(validateCourse(course)).toEqual([]);
});
