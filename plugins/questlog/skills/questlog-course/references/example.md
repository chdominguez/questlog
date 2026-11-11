# Annotated example course

A complete, valid single-file course that uses every theory block and every challenge type. Copy its shape, not its topic. A real course splits levels and katas into files (see SKILL.md) and has 4–8 cards and 5–10 challenges per level; this one is trimmed to show each feature once.

Save as `courses/event-loop/course.ts` and run `npm run validate event-loop`.

```ts
import { at, defineCourse, hl } from "questlog/authoring";
import type { FlowStep, TraceStep } from "questlog/authoring";

// One sample, reused by the code card, the trace, the flow and the challenges.
const ORDER = `console.log("A");
setTimeout(() => console.log("B"), 0);
Promise.resolve().then(() => console.log("C"));
console.log("D");`;

// Trace: each line comes from at(src, needle), which throws unless exactly one line matches.
// vars hold only what changes; earlier values carry forward. Values are display strings.
const TRACE: TraceStep[] = [
  { line: at(ORDER, `log("A")`), vars: { output: "A" } },
  { line: at(ORDER, "setTimeout"), vars: { tasks: "[log B]" }, note: "The callback waits in the **task** queue, even with 0 ms." },
  { line: at(ORDER, "Promise.resolve"), vars: { microtasks: "[log C]" } },
  { line: at(ORDER, `log("D")`), vars: { output: "A D" }, note: "The script finishes before any queued callback runs." },
  { line: at(ORDER, "Promise.resolve"), vars: { output: "A D C", microtasks: "[]" }, note: "Microtasks drain first." },
  { line: at(ORDER, "setTimeout"), vars: { output: "A D C B", tasks: "[]" } },
];

// Flow: actors left to right; every from/to must be an actor; data defaults to json, set lang otherwise.
const FLOW: FlowStep[] = [
  { from: "Script", to: "Timers", label: "setTimeout(cb, 0)", lang: "ts", data: `setTimeout(() => console.log("B"), 0);` },
  { from: "Timers", to: "Task queue", label: "0 ms elapsed", lang: "text", data: "task: log B" },
  { from: "Script", to: "Microtasks", label: "then(cb)", lang: "text", data: "microtask: log C" },
  { from: "Microtasks", to: "Script", label: "stack empty: run C", lang: "text", data: "C", note: "All microtasks run before the next task." },
  { from: "Task queue", to: "Script", label: "next task: run B", lang: "text", data: "B" },
];

export default defineCourse({
  id: "event-loop",
  title: "The JavaScript event loop",
  lang: "en",
  summary: "Why setTimeout(fn, 0) runs after a resolved promise.",
  // Inline SVG: viewBox, no width/height, no hex colors (theme vars only), under 4 KB, no href/url()/images.
  art: {
    loop: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="var(--raise)"/><circle cx="60" cy="60" r="30" fill="none" stroke="var(--accent)" stroke-width="8"/><path d="M84 44l6 16-16-4z" fill="var(--accent)"/><circle cx="60" cy="60" r="8" fill="var(--gold)"/></svg>`,
  },
  grader: {
    persona: "You are a senior JavaScript engineer reviewing a colleague's explanation. Be strict about ordering facts and fair about wording. 10 = precise and complete; 7 = right with small gaps; 5 = vague; 3 or less = wrong order or missing the queues. Write the improved answer in plain, spoken English.",
  },
  levels: [
    {
      id: "queues",
      order: 1,
      title: "Tasks and microtasks",
      art: "loop", // map node art: a key in course.art
      boss: true, // a one-level course: the only level is also the last one
      theory: [
        {
          title: "Two queues",
          blocks: [
            { kind: "figure", art: "loop", caption: "One loop, two queues" },
            { kind: "md", text: "After the script finishes, the loop drains **every microtask** (promise callbacks), then runs **one task** (timers, events), then drains microtasks again." },
          ],
        },
        {
          title: "Predict the output",
          blocks: [
            // code: static excerpt; hl(src, ...needles) builds 1-based highlight lines and throws on a missing needle.
            { kind: "code", lang: "js", src: ORDER, title: "order.js", highlight: hl(ORDER, "setTimeout", "Promise.resolve") },
            { kind: "trace", lang: "js", src: ORDER, title: "Step through", steps: TRACE },
          ],
        },
        {
          title: "Where callbacks wait",
          blocks: [
            { kind: "flow", actors: ["Script", "Timers", "Task queue", "Microtasks"], steps: FLOW, caption: "Who hands each callback back" },
            { kind: "mermaid", src: "flowchart LR\n  S[Run script] --> M[Drain microtasks] --> T[Run one task] --> M", caption: "The loop" },
          ],
        },
      ],
      challenges: [
        {
          id: "queues-output", // unique across the course; never rename once published
          type: "quiz",
          prompt: "What does `order.js` print?",
          code: { lang: "js", src: ORDER },
          options: ["A D C B", "A B C D", "A D B C", "A C D B"], // right one FIRST; the UI shuffles
          answer: 0,
          explain: "Synchronous code first (A, D), then microtasks (C), then the next task (B). **A D B C** treats a 0 ms timer as immediate.",
        },
        {
          id: "queues-order",
          type: "order",
          prompt: "Put one turn of the event loop in order.",
          steps: ["Run the current script to completion", "Drain the microtask queue", "Take one task from the task queue", "Drain the microtask queue again"], // CORRECT order
          explain: "Microtasks always drain before the next task.",
        },
        {
          id: "queues-bug",
          type: "bug",
          prompt: "`save()` must finish before `\"saved\"` is logged. Which line breaks that?",
          lang: "ts",
          lines: ["async function onClick() {", "  save();", "  console.log(\"saved\");", "}"],
          answer: 1, // 0-based index of the one wrong line
          explain: "Without `await`, `save()` returns a pending promise and the log runs first. Write `await save();`.",
        },
        {
          id: "queues-written",
          type: "written",
          prompt: "Explain why `setTimeout(fn, 0)` runs after `Promise.resolve().then(fn)`.",
          seconds: 60, // soft limit, optional
          keyPoints: ["Timer callbacks are tasks; promise callbacks are microtasks", "The microtask queue drains completely before the next task", "0 ms is a minimum delay, not immediate execution"],
          model: "The timer callback goes to the task queue and the promise callback to the microtask queue. When the script finishes, the loop drains all microtasks before taking the next task, so the promise callback runs first. A 0 ms delay only means the task is ready soon, not that it runs now.",
        },
        { id: "queues-kata", type: "kata", prompt: "Write `chunk`.", kataId: "chunk" },
      ],
    },
  ],
  katas: [
    {
      id: "chunk",
      title: "Chunk an array",
      difficulty: "easy",
      statement: "Return `xs` split into arrays of `size` items; the last chunk may be shorter. If `size < 1`, return `[]`.",
      examples: [{ input: "[1, 2, 3, 4, 5], 2", output: "[[1, 2], [3, 4], [5]]" }],
      starter: "function chunk(xs: number[], size: number): number[][] {\n  return [];\n}\n", // compiles, fails a test
      solution: "function chunk(xs: number[], size: number): number[][] {\n  if (size < 1) return [];\n  const out: number[][] = [];\n  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));\n  return out;\n}\n",
      complexity: "**O(n)** time and space.",
      // JS run after the user's code; must return eq(got, expected).
      tests: [
        { name: "Example", code: "return eq(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])" },
        { name: "Exact fit", code: "return eq(chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]])" },
        { name: "Empty", code: "return eq(chunk([], 3), [])" },
      ],
      hidden: [
        { name: "Size bigger than array", code: "return eq(chunk([1, 2], 5), [[1, 2]])" },
        { name: "Size zero", code: "return eq(chunk([1, 2], 0), [])" },
      ],
    },
  ],
});
```

## What each part shows

| Feature | Where |
|---|---|
| `md`, `figure` blocks | card "Two queues" |
| `code` with `hl()`, `trace` with `at()` | card "Predict the output" |
| `flow`, `mermaid` | card "Where callbacks wait" |
| quiz with `code`, order, bug, written, kata | `challenges` |
| art used by `level.art` and `figure` | `art.loop` |
| grader persona in the course language | `grader` |
| kata with 3 visible and 2 hidden tests | `katas` |
