/**
 * Course content contract: the single source for types, validation and the JSON Schema given to AI authors.
 * Fields marked (md) are Markdown rendered by <Md> (src/ui/Md.tsx). A course must stay JSON-serializable.
 */
import * as z from "zod";
import { mediaRefProblem } from "../../shared/media";

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
  z.object({
    ...base, type: z.literal("multi"),
    options: z.array(md("Option")).min(2).max(6).describe("Shuffled by the UI, except style truefalse"),
    answers: z.array(z.number().int().min(0)).min(1).describe("0-based indexes of every right option; unique, fewer than options"),
    style: z.literal("truefalse").optional().describe("Fixed order; options must be exactly [True, False] and one answer"),
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
  z.object({
    ...base, type: z.literal("match"),
    pairs: z.array(z.object({ left: md("Left item"), right: md("Matching right item") }).strict()).min(3).max(8).describe("Unique lefts and unique rights; the UI shuffles the right column"),
  }).strict(),
  z.object({
    ...base, type: z.literal("cloze"),
    text: z.string().min(1).describe("Text with numbered markers {{1}}, {{2}}, ... each used once, contiguous from 1"),
    blanks: z.array(z.object({
      answers: z.array(z.string().min(1)).min(1).describe("Accepted variants; the first is shown as the answer"),
      exact: z.boolean().optional().describe("Case- and whitespace-sensitive; default false"),
    }).strict()).min(1),
    bank: z.array(z.string().min(1)).optional().describe("Word bank chips; each blank's first answer must be in it. Omit for typed blanks"),
    lang: CodeLangSchema.optional().describe("Render text as code in this language; default Markdown"),
  }).strict(),
  z.object({
    ...base, type: z.literal("sort"),
    buckets: z.array(md("Bucket label")).min(2).max(4),
    items: z.array(z.object({ text: md("Item"), bucket: z.number().int().min(0).describe("0-based index into buckets") }).strict()).min(4).max(12),
  }).strict().describe("Drop each item into the bucket it belongs to"),
  z.object({ ...base, type: z.literal("flashcard"), back: md("The back, shown on reveal; the prompt is the front") }).strict(),
  z.object({ ...base, type: z.literal("kata"), kataId: id.describe("Id of a kata in this course") }).strict(),
]);

/** Challenge types that can run inline in theory as ungraded practice. */
export const PRACTICE_TYPES = ["quiz", "multi", "order", "match", "sort", "cloze"] as const;

export const TheoryBlockSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("md"), text: md("Prose") }).strict(),
  z.object({
    kind: z.literal("code"), lang: CodeLangSchema, src: z.string().min(1), title: z.string().optional(),
    highlight: z.array(z.number().int().min(1)).optional().describe("1-based lines to highlight; author them with hl(src, ...needles)"),
  }).strict(),
  z.object({ kind: z.literal("mermaid"), src: z.string().min(1), caption: z.string().optional() }).strict(),
  z.object({ kind: z.literal("figure"), art: z.string().describe("Key in the course art map or platform art"), caption: z.string().optional() }).strict(),
  z.object({
    kind: z.literal("media"), type: z.enum(["image", "video", "audio"]).describe("A GIF is an image"),
    src: z.string().describe("Course-relative file, e.g. media/demo.mp4; upload it with media_upload"),
    alt: z.string().min(1).describe("What the media shows or says"), caption: z.string().optional(),
    poster: z.string().optional().describe("Video only: preview image, e.g. media/demo.jpg"),
  }).strict(),
  z.object({
    kind: z.literal("trace"), lang: CodeLangSchema, src: z.string().min(1), title: z.string().optional(),
    steps: z.array(TraceStepSchema).min(2),
  }).strict().describe("Step-through run of code with sample values"),
  z.object({
    kind: z.literal("flow"), actors: z.array(z.string().min(1)).min(2), steps: z.array(FlowStepSchema).min(2), caption: z.string().optional(),
  }).strict().describe("A request hopping between actors with its payload"),
  z.object({
    kind: z.literal("drill"), prompt: md("Shown above the drill").optional(),
    pairs: z.array(z.object({ left: md("Left item"), right: md("Matching right item") }).strict()).min(3).max(12)
      .describe("Unique lefts and unique rights. Introduced one at a time with repetition, then all together"),
  }).strict().describe("Incremental matching game that reinforces a table or list right above it; practice only"),
  z.object({
    kind: z.literal("practice"),
    challenge: ChallengeSchema.refine((ch) => (PRACTICE_TYPES as readonly string[]).includes(ch.type), { message: `practice challenge type must be one of ${PRACTICE_TYPES.join(", ")}` }),
  }).strict().describe("Ungraded challenge inside a theory card to reinforce what was just read"),
]);

export const TheoryCardSchema = z.object({ title: z.string().min(1), blocks: z.array(TheoryBlockSchema).min(1) }).strict();

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
  code: z.string().min(1).describe('Run after the user code, in the kata lang (JS or Python); a function body that must `return eq(got, expected)`, e.g. "return eq(sum([1,2]), 3)"'),
}).strict();

export const KataSchema = z.object({
  id,
  title: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  statement: md("Problem statement"),
  examples: z.array(z.object({ input: z.string(), output: z.string(), note: z.string().optional() }).strict()).min(1),
  lang: z.enum(["ts", "python"]).optional().describe("Language the learner writes; default ts. Python runs in the browser through Pyodide"),
  starter: z.string().min(1).describe("Code the user starts from (in lang); must compile and fail at least one test"),
  solution: z.string().min(1).describe("Reference solution (in lang); must pass every test"),
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
  users: z.array(z.email()).optional().describe("Emails of the signed-in users who see this course; omit for everyone"),
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
  const chIds = c.levels.flatMap((l, li) => [
    ...l.challenges.map((ch, ci) => ({ id: ch.id, at: ["levels", li, "challenges", ci, "id"] })),
    ...l.theory.flatMap((card, ti) => card.blocks.flatMap((b, bi) =>
      b.kind === "practice" ? [{ id: b.challenge.id, at: ["levels", li, "theory", ti, "blocks", bi, "challenge", "id"] }] : [])),
  ]);
  dup(chIds.map((x) => x.id), (i) => chIds[i].at, "challenge");
  const uniqueSides = (pairs: { left: string; right: string }[], at: (string | number)[]) => {
    for (const side of ["left", "right"] as const) {
      const seen = new Set<string>();
      pairs.forEach((p, pi) => { if (seen.has(p[side])) issue([...at, "pairs", pi, side], `duplicate ${side} item`); seen.add(p[side]); });
    }
  };
  const checkChallenge = (ch: Challenge, at: (string | number)[]) => {
    if (ch.type === "quiz" && ch.answer >= ch.options.length) issue([...at, "answer"], `answer ${ch.answer} but only ${ch.options.length} options`);
    if (ch.type === "multi") {
      if (ch.answers.some((a) => a >= ch.options.length)) issue([...at, "answers"], `answers ${JSON.stringify(ch.answers)} but only ${ch.options.length} options`);
      if (new Set(ch.answers).size !== ch.answers.length) issue([...at, "answers"], "answers must be unique");
      if (ch.answers.length >= ch.options.length) issue([...at, "answers"], "answers must be fewer than options (otherwise nothing is a wrong pick)");
      if (ch.style === "truefalse" && (ch.options.length !== 2 || ch.answers.length !== 1)) issue([...at, "style"], "truefalse needs exactly 2 options and 1 answer");
    }
    if (ch.type === "bug" && ch.answer >= ch.lines.length) issue([...at, "answer"], `answer ${ch.answer} but only ${ch.lines.length} lines`);
    if (ch.type === "match") uniqueSides(ch.pairs, at);
    if (ch.type === "cloze") {
      const marks = [...ch.text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
      if (marks.length !== ch.blanks.length || marks.some((m, i) => m !== i + 1)) issue([...at, "text"], `markers must be {{1}}..{{${ch.blanks.length}}} in order, once each, matching blanks`);
      ch.blanks.forEach((b, bi) => {
        if (ch.bank && !ch.bank.includes(b.answers[0])) issue([...at, "blanks", bi, "answers", 0], `"${b.answers[0]}" is not in bank`);
      });
    }
    if (ch.type === "sort") {
      ch.items.forEach((it, ii) => { if (it.bucket >= ch.buckets.length) issue([...at, "items", ii, "bucket"], `bucket ${it.bucket} but only ${ch.buckets.length} buckets`); });
      ch.buckets.forEach((_, bi) => { if (!ch.items.some((it) => it.bucket === bi)) issue([...at, "buckets", bi], `bucket ${bi} has no items`); });
    }
    if (ch.type === "kata" && !katas.has(ch.kataId)) issue([...at, "kataId"], `no kata "${ch.kataId}" in course.katas`);
  };
  c.levels.forEach((l, li) => {
    if (l.art && !art.has(l.art)) issue(["levels", li, "art"], `art "${l.art}" is not in course.art`);
    l.theory.forEach((card, ti) => card.blocks.forEach((b, bi) => {
      const at = ["levels", li, "theory", ti, "blocks", bi];
      if (b.kind === "figure" && !art.has(b.art)) issue([...at, "art"], `art "${b.art}" is not in course.art`);
      if (b.kind === "media") {
        const p = mediaRefProblem(b.src, [b.type]);
        if (p) issue([...at, "src"], p);
        if (b.poster !== undefined) {
          const q = b.type !== "video" ? "only videos have a poster" : mediaRefProblem(b.poster, ["image"]);
          if (q) issue([...at, "poster"], q);
        }
      }
      const lines = "src" in b ? b.src.replace(/\n$/, "").split("\n").length : 0;
      if (b.kind === "trace") b.steps.forEach((s, si) => {
        if (s.line > lines) issue([...at, "steps", si, "line"], `line ${s.line} is past the end of src (${lines} lines)`);
      });
      if (b.kind === "code") b.highlight?.forEach((h, hi) => {
        if (h > lines) issue([...at, "highlight", hi], `line ${h} is past the end of src (${lines} lines)`);
      });
      if (b.kind === "drill") uniqueSides(b.pairs, at);
      if (b.kind === "practice") checkChallenge(b.challenge, [...at, "challenge"]);
      if (b.kind === "flow") b.steps.forEach((s, si) => {
        for (const end of ["from", "to"] as const) {
          if (!b.actors.includes(s[end])) issue([...at, "steps", si, end], `"${s[end]}" is not one of the actors ${JSON.stringify(b.actors)}`);
        }
      });
    }));
    l.challenges.forEach((ch, ci) => checkChallenge(ch, ["levels", li, "challenges", ci]));
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
