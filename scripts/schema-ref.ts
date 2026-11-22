// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 chdominguez and contributors
// Usage: npm run site:schema   Writes the site's JSON Schema and the generated schema reference page from src/course/schema.ts.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as z from "zod";
import {
  ChallengeSchema, CodeLangSchema, CourseSchema, FlowStepSchema, KataSchema, KataTestSchema, LevelSchema,
  TheoryBlockSchema, TheoryCardSchema, TraceStepSchema,
} from "../src/course/schema";

const root = resolve(import.meta.dirname, "..");
export const OUT = {
  json: resolve(root, "site/public/schema/course.json"),
  md: resolve(root, "site/src/content/docs/authoring/reference.md"),
};

const def = (s: unknown) => (s as { _zod: { def: any } })._zod.def;
const options = (u: unknown): z.ZodObject[] => def(u).options;

/** Named schemas link to their own section instead of being expanded inline. */
const NAMED = new Map<unknown, [string, string]>([
  [LevelSchema, ["Level", "level"]], [TheoryCardSchema, ["TheoryCard", "theorycard"]],
  [TheoryBlockSchema, ["TheoryBlock", "theory-blocks"]], [ChallengeSchema, ["Challenge", "challenges"]],
  [KataSchema, ["Kata", "kata"]], [KataTestSchema, ["KataTest", "katatest"]],
  [TraceStepSchema, ["TraceStep", "tracestep"]], [FlowStepSchema, ["FlowStep", "flowstep"]], [CodeLangSchema, ["CodeLang", "codelang"]],
]);
const named = (s: unknown) => NAMED.get(s) ?? (def(s).type === "union" && def(s).discriminator === "type" ? NAMED.get(ChallengeSchema) : undefined);

function unwrap(s: z.ZodType): { s: z.ZodType; optional: boolean; description?: string } {
  let optional = false, description = s.description;
  while (["optional", "default", "nullable"].includes(def(s).type)) { optional = true; s = def(s).innerType; description ??= s.description; }
  return { s, optional, description };
}

function typeOf(s: z.ZodType): string {
  const n = named(s);
  if (n) return `[${n[0]}](#${n[1]})`;
  const d = def(s);
  switch (d.type) {
    case "string": return d.format === "email" ? "email" : d.format === "url" ? "URL" : "string";
    case "number": return (s as z.ZodNumber).isInt ? "integer" : "number";
    case "boolean": return "boolean";
    case "literal": return d.values.map((v: unknown) => `\`${JSON.stringify(v)}\``).join(" \\| ");
    case "enum": return Object.values(d.entries).map((v) => `\`"${v}"\``).join(" \\| ");
    case "array": { const t = typeOf(unwrap(d.element).s); return t.includes(" ") ? `(${t})[]` : `${t}[]`; }
    case "record": return `map of string to ${typeOf(unwrap(d.valueType).s)}`;
    case "object": return "object";
    default: return d.type;
  }
}

/** Length and range checks as plain text, e.g. "2 to 6 items". */
function rules(s: z.ZodType): string {
  const d = def(s);
  const checks = (d.checks ?? []).map((c: unknown) => def(c));
  const min = checks.find((c: any) => c.check === "min_length")?.minimum;
  const max = checks.find((c: any) => c.check === "max_length")?.maximum;
  const gt = checks.find((c: any) => c.check === "greater_than");
  const pattern = d.format === "regex" ? d.pattern : checks.find((c: any) => c.format === "regex")?.pattern;
  const out: string[] = [];
  if (d.type === "array") {
    if (min !== undefined && max !== undefined) out.push(`${min} to ${max} items`);
    else if (min !== undefined) out.push(`at least ${min} item${min === 1 ? "" : "s"}`);
  } else if (d.type === "string" && min) out.push("non-empty");
  if (gt) out.push(gt.inclusive ? `>= ${gt.value}` : `> ${gt.value}`);
  if (pattern) out.push(`matches \`${pattern.source}\``);
  return out.join(", ");
}

const cell = (t: string) => t.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** Rows for an object schema; unnamed nested objects are flattened into dotted paths. */
function rows(obj: z.ZodObject, prefix = ""): string[] {
  return Object.entries(obj.shape).flatMap(([key, raw]) => {
    const { s, optional, description } = unwrap(raw as z.ZodType);
    const path = `${prefix}${key}`;
    const r = rules(s);
    const desc = [description, r].filter(Boolean).join("; ");
    const row = `| \`${path}\` | ${typeOf(s)} | ${optional ? "no" : "yes"} | ${cell(desc)} |`;
    const inner = def(s).type === "array" ? unwrap(def(s).element).s : s;
    const nest = !named(inner) && def(inner).type === "object" ? rows(inner as z.ZodObject, `${path}${inner === s ? "." : "[]."}`) : [];
    return [row, ...nest];
  });
}

const table = (obj: z.ZodObject) => ["| Field | Type | Required | Description |", "|---|---|---|---|", ...rows(obj)].join("\n");
const variant = (o: z.ZodObject, key: "type" | "kind") => def(o.shape[key]).values[0] as string;

/** Rules the schema enforces across fields (superRefine and the kata runner), kept in sync by hand. */
const CROSS_RULES = [
  "Level, kata and challenge ids are unique. Challenge ids are unique across the whole course, including `practice` challenges inside theory.",
  "`quiz.answer` and `bug.answer` point at an existing option or line.",
  "`multi.answers` are unique, point at existing options and are fewer than the options. With `style: \"truefalse\"` there are exactly 2 options and 1 answer.",
  "`match` and `drill` pairs have unique left items and unique right items.",
  "`cloze.text` uses the markers `{{1}}` to `{{N}}` in order, once each, one per blank. With a `bank`, each blank's first answer is in the bank.",
  "`sort` items point at an existing bucket, and every bucket has at least one item.",
  "`kata` challenges point at a kata in `course.katas`.",
  "`level.art` and `figure.art` are keys of `course.art`. Every art value is a single inline `<svg>` with a `viewBox`, no `width` or `height` on the root, under 4 KB, with no `href`, `url()`, `<image>`, `<script>` or hex colors.",
  "`trace` step lines and `code` highlight lines exist in `src`.",
  "`flow` step `from` and `to` are listed in `actors`.",
  "`media.src` is a flat `media/<file>` ref with an extension for its type: image `png jpg jpeg webp gif avif`, video `mp4 webm`, audio `mp3 ogg m4a wav`. Only videos take a `poster`, and it is an image ref.",
  "`practice` challenges are one of `quiz`, `multi`, `order`, `match`, `sort`, `cloze`.",
  "Kata solutions pass every test in `tests` and `hidden`. Kata starters compile and fail at least one test.",
  "Every object is strict: an unknown or misspelled field is an error.",
];

export function renderReference(): string {
  const out: string[] = [
    "---",
    "title: Schema reference",
    "description: Every field of the Questie course format, generated from the schema the validator uses.",
    "sidebar: { order: 9 }",
    "---",
    "",
    "Generated from `src/course/schema.ts`, the same schema `npm run validate`, the MCP server and the AI course builder use.",
    "",
    "Point a `course.json` at the JSON Schema to get completion and checks in your editor:",
    "",
    "```json",
    '{ "$schema": "https://questie.app/schema/course.json", "id": "my-course" }',
    "```",
    "",
    "## Course", "", table(CourseSchema as unknown as z.ZodObject), "",
    "## Level", "", table(LevelSchema), "",
    "## TheoryCard", "", table(TheoryCardSchema), "",
    "## Theory blocks", "", "A theory card holds a list of blocks. `kind` picks the block.", "",
  ];
  for (const o of options(TheoryBlockSchema)) out.push(`### ${variant(o, "kind")}`, "", ...(o.description ? [o.description + ".", ""] : []), table(o), "");
  out.push("## Challenges", "", "`type` picks the challenge. Every type takes `id`, `prompt`, `explain`, `tip` and `code`.", "");
  for (const o of options(ChallengeSchema)) out.push(`### ${variant(o, "type")}`, "", ...(o.description ? [o.description + ".", ""] : []), table(o), "");
  out.push(
    "## Kata", "", table(KataSchema), "",
    "## KataTest", "", table(KataTestSchema), "",
    "## TraceStep", "", table(TraceStepSchema), "",
    "## FlowStep", "", table(FlowStepSchema), "",
    "## CodeLang", "", `${CodeLangSchema.options.map((l) => `\`"${l}"\``).join(", ")}.`, "",
    "## Rules across fields", "", ...CROSS_RULES.map((r) => `- ${r}`), "",
  );
  return out.join("\n");
}

export const courseJsonSchema = () => z.toJSONSchema(CourseSchema, { io: "input" });

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const [file, text] of [[OUT.json, JSON.stringify(courseJsonSchema(), null, 2)], [OUT.md, renderReference()]]) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text + "\n");
    console.log(`wrote ${file.slice(root.length + 1)}`);
  }
}
