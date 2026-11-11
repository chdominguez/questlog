/**
 * Course content contract: the single source for types, validation and the JSON Schema given to AI authors.
 * Fields marked (md) are Markdown rendered by <Md> (src/ui/Md.tsx). A course must stay JSON-serializable.
 */
import * as z from "zod";

const md = (what: string) => z.string().min(1).describe(`${what} (Markdown)`);
const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase letters, digits and dashes").describe("Stable id, lowercase-kebab");

export const CodeLangSchema = z.enum(["ts", "tsx", "js", "json", "bash", "sql", "yaml", "http", "python", "text"]);

export const TraceStepSchema = z.object({
  line: z.number().int().min(1).describe("1-based line about to execute; author it with at(src, needle)"),
  vars: z.record(z.string(), z.string()).optional()
    .describe("Only the values that change at this step; earlier values carry forward. Shown verbatim, e.g. { status: '\"pending\"' }"),
  note: md("What to notice at this step").optional(),
}).strict();

export const FlowStepSchema = z.object({
  from: z.string().describe("Must be one of the flow's actors"),
  to: z.string().describe("Must be one of the flow's actors; same as from for a self-call"),
  label: z.string().min(1),
  data: z.string().optional().describe("Payload carried by this hop"),
  lang: CodeLangSchema.optional().describe("Language of data, default json"),
  note: md("What to notice at this hop").optional(),
}).strict();

export const TheoryBlockSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("md"), text: md("Prose") }).strict(),
  z.object({
    kind: z.literal("code"), lang: CodeLangSchema, src: z.string().min(1), title: z.string().optional(),
    highlight: z.array(z.number().int().min(1)).optional().describe("1-based lines to highlight; author them with hl(src, ...needles)"),
  }).strict(),
  z.object({ kind: z.literal("mermaid"), src: z.string().min(1), caption: z.string().optional() }).strict(),
  z.object({ kind: z.literal("figure"), art: z.string().describe("Key in the course art map or platform art"), caption: z.string().optional() }).strict(),
  z.object({
    kind: z.literal("trace"), lang: CodeLangSchema, src: z.string().min(1), title: z.string().optional(),
    steps: z.array(TraceStepSchema).min(2),
  }).strict().describe("Step-through run of code with sample values"),
  z.object({
    kind: z.literal("flow"), actors: z.array(z.string().min(1)).min(2), steps: z.array(FlowStepSchema).min(2), caption: z.string().optional(),
  }).strict().describe("A request hopping between actors with its payload"),
]);

export const TheoryCardSchema = z.object({ title: z.string().min(1), blocks: z.array(TheoryBlockSchema).min(1) }).strict();

const base = {
  id: id.describe("Unique within the course"),
  prompt: md("The question"),
  explain: md("Shown after answering").optional(),
  code: z.object({ lang: CodeLangSchema, src: z.string().min(1) }).strict().optional().describe("Snippet shown with the prompt (not for bug)"),
};

export const ChallengeSchema = z.discriminatedUnion("type", [
  z.object({
    ...base, type: z.literal("quiz"),
    options: z.array(md("Option")).min(2).max(6).describe("Author the right one first; the UI shuffles"),
    answer: z.number().int().min(0).describe("0-based index of the right option"),
  }).strict(),
  z.object({ ...base, type: z.literal("order"), steps: z.array(md("Step")).min(3).describe("In CORRECT order; the UI shuffles") }).strict(),
  z.object({
    ...base, type: z.literal("bug"), lang: CodeLangSchema,
    lines: z.array(z.string()).min(3).describe("Code lines; exactly one is the bug"),
    answer: z.number().int().min(0).describe("0-based index of the buggy line"),
  }).strict(),
  z.object({
    ...base, type: z.literal("written"),
    model: md("Model answer"),
    keyPoints: z.array(z.string().min(1)).min(2).describe("What a strong answer must mention; sent to the grader"),
    seconds: z.number().int().positive().optional().describe("Soft time limit"),
  }).strict(),
  z.object({ ...base, type: z.literal("kata"), kataId: id.describe("Id of a kata in this course") }).strict(),
]);

export const LevelSchema = z.object({
  id,
  order: z.number().describe("Map position"),
  title: z.string().min(1),
  art: z.string().optional().describe("Key in the course art map"),
  theory: z.array(TheoryCardSchema),
  challenges: z.array(ChallengeSchema),
  boss: z.boolean().optional().describe("Final level, drawn last on the map"),
}).strict();

export const KataTestSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).describe('JS run after the user code; must `return eq(got, expected)`, e.g. "return eq(sum([1,2]), 3)"'),
}).strict();

export const KataSchema = z.object({
  id,
  title: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  statement: md("Problem statement"),
  examples: z.array(z.object({ input: z.string(), output: z.string(), note: z.string().optional() }).strict()).min(1),
  starter: z.string().min(1).describe("TypeScript the user starts from; must compile and fail at least one test"),
  solution: z.string().min(1).describe("TypeScript reference solution; must pass every test"),
  complexity: md("Time and space complexity"),
  tests: z.array(KataTestSchema).min(3).describe("Visible tests (Run)"),
  hidden: z.array(KataTestSchema).min(2).describe("Extra tests on Submit"),
}).strict();

/** Why an inline SVG breaks the art rules (themed via CSS variables, scalable, small, no external refs), or null. */
export function artProblem(svg: string): string | null {
  const root = svg.match(/^<svg[^>]*>/)?.[0];
  if (!root || !svg.endsWith("</svg>")) return "must be a single <svg>…</svg>";
  if (!/viewBox="[\d. ]+"/.test(root)) return "root needs a viewBox";
  if (/\s(width|height)=/.test(root)) return "root must not set width/height";
  if (new TextEncoder().encode(svg).length >= 4096) return "must be under 4 KB";
  if (/href|url\(|<image|<script|#[0-9a-f]{3,6}\b/i.test(svg)) return "no hrefs, url(), images, scripts or hex colors; use var(--accent) etc.";
  return null;
}

export const CourseSchema = z.object({
  id,
  title: z.string().min(1),
  lang: z.string().min(2).describe("BCP 47 language of the content, e.g. en, es-ES; used for grading, dictation and dates"),
  summary: z.string().optional().describe("One line shown on the home screen"),
  levels: z.array(LevelSchema).min(1),
  katas: z.array(KataSchema).optional(),
  art: z.record(z.string(), z.string()).optional().describe("Inline SVG strings by key, used by level.art and figure blocks"),
  grader: z.object({
    persona: z.string().min(1).describe("Who grades written answers and how strict, in the course language"),
  }).strict().optional(),
  mock: z.object({
    title: z.string().min(1),
    seconds: z.number().int().positive(),
  }).strict().optional().describe("Timed exam over the boss level's written challenges"),
}).strict().superRefine((c, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  const dup = (ids: string[], path: (i: number) => (string | number)[], what: string) => {
    const seen = new Set<string>();
    ids.forEach((x, i) => { if (seen.has(x)) issue(path(i), `duplicate ${what} id "${x}"`); seen.add(x); });
  };
  const katas = new Set((c.katas ?? []).map((k) => k.id));
  const art = new Set(Object.keys(c.art ?? {}));
  Object.entries(c.art ?? {}).forEach(([k, v]) => { const p = artProblem(v); if (p) issue(["art", k], p); });
  dup(c.levels.map((l) => l.id), (i) => ["levels", i, "id"], "level");
  dup((c.katas ?? []).map((k) => k.id), (i) => ["katas", i, "id"], "kata");
  const chIds = c.levels.flatMap((l, li) => l.challenges.map((ch, ci) => ({ id: ch.id, li, ci })));
  dup(chIds.map((x) => x.id), (i) => ["levels", chIds[i].li, "challenges", chIds[i].ci, "id"], "challenge");
  c.levels.forEach((l, li) => {
    if (l.art && !art.has(l.art)) issue(["levels", li, "art"], `art "${l.art}" is not in course.art`);
    l.theory.forEach((card, ti) => card.blocks.forEach((b, bi) => {
      const at = ["levels", li, "theory", ti, "blocks", bi];
      if (b.kind === "figure" && !art.has(b.art)) issue([...at, "art"], `art "${b.art}" is not in course.art`);
      const lines = "src" in b ? b.src.replace(/\n$/, "").split("\n").length : 0;
      if (b.kind === "trace") b.steps.forEach((s, si) => {
        if (s.line > lines) issue([...at, "steps", si, "line"], `line ${s.line} is past the end of src (${lines} lines)`);
      });
      if (b.kind === "code") b.highlight?.forEach((h, hi) => {
        if (h > lines) issue([...at, "highlight", hi], `line ${h} is past the end of src (${lines} lines)`);
      });
      if (b.kind === "flow") b.steps.forEach((s, si) => {
        for (const end of ["from", "to"] as const) {
          if (!b.actors.includes(s[end])) issue([...at, "steps", si, end], `"${s[end]}" is not one of the actors ${JSON.stringify(b.actors)}`);
        }
      });
    }));
    l.challenges.forEach((ch, ci) => {
      const at = ["levels", li, "challenges", ci];
      if (ch.type === "quiz" && ch.answer >= ch.options.length) issue([...at, "answer"], `answer ${ch.answer} but only ${ch.options.length} options`);
      if (ch.type === "bug" && ch.answer >= ch.lines.length) issue([...at, "answer"], `answer ${ch.answer} but only ${ch.lines.length} lines`);
      if (ch.type === "kata" && !katas.has(ch.kataId)) issue([...at, "kataId"], `no kata "${ch.kataId}" in course.katas`);
    });
  });
});

export type CodeLang = z.infer<typeof CodeLangSchema>;
export type TraceStep = z.infer<typeof TraceStepSchema>;
export type FlowStep = z.infer<typeof FlowStepSchema>;
export type TheoryBlock = z.infer<typeof TheoryBlockSchema>;
export type TheoryCard = z.infer<typeof TheoryCardSchema>;
export type Challenge = z.infer<typeof ChallengeSchema>;
export type ChallengeType = Challenge["type"];
export type Level = z.infer<typeof LevelSchema>;
export type KataTest = z.infer<typeof KataTestSchema>;
export type Kata = z.infer<typeof KataSchema>;
export type CourseInput = z.infer<typeof CourseSchema>;

/** Readable one-line-per-issue report, e.g. `levels[2].challenges[0].answer: answer 4 but only 3 options`. */
export function formatIssues(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.reduce<string>((s, p) => (typeof p === "number" ? `${s}[${p}]` : s ? `${s}.${String(p)}` : String(p)), "") || "(root)"}: ${i.message}`).join("\n");
}
