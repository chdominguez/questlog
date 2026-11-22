// Shared test fixtures for builder, jobs and courses tests.
import type { Kata, Level } from "../src/course/schema";
import type { KataRunner } from "./sandbox";
import type { Deps, SessionUser } from "./api";

const t = (name: string, code: string) => ({ name, code });
export const kata = (id: string): Kata => ({
  id, title: "Sum", difficulty: "easy", statement: "Sum the list", examples: [{ input: "[1,2]", output: "3" }], complexity: "O(n)",
  starter: "function sum(xs: number[]) { return 0; }", solution: "function sum(xs: number[]) { return xs.reduce((a, b) => a + b, 0); }",
  tests: [t("a", "return eq(sum([1]), 1)"), t("b", "return eq(sum([2]), 2)"), t("c", "return eq(sum([1, 2]), 3)")],
  hidden: [t("d", "return eq(sum([3]), 3)"), t("e", "return eq(sum([4]), 4)")],
});

export const level = (id: string, o: { kata?: string; sources?: { url: string; title: string }[] } = {}): Level => ({
  id, order: 1, title: `Level ${id}`,
  theory: [{ title: "Card", blocks: [{ kind: "md", text: "Text" }], ...(o.sources && { sources: o.sources }) }],
  challenges: [
    { id: `${id}-q`, type: "quiz", prompt: "P", options: ["a", "b"], answer: 0 },
    { id: `${id}-m`, type: "multi", prompt: "P", options: ["a", "b", "c"], answers: [0, 1] },
    { id: `${id}-f`, type: "flashcard", prompt: "Front", back: "Back" },
    ...(o.kata ? [{ id: `${id}-k`, type: "kata" as const, prompt: "Solve", kataId: o.kata }] : []),
  ],
});

export const course = (id: string, over: object = {}) => ({ id, title: "Course", lang: "en", levels: [level("one")], ...over });

/** Solutions pass, everything else fails; no child process. */
export const fakeSandbox: KataRunner = async (k, code) => [...k.tests, ...k.hidden].map((x) => ({ name: x.name, pass: code === k.solution, logs: [] }));

export const account = (id: string): SessionUser => ({ id, email: `${id}@x.com`, name: id.toUpperCase(), emailVerified: true });
/** The user id comes from x-test-user; "u" by default. */
export const session: Deps["session"] = async (c) => account(c.req.header("x-test-user") ?? "u");
export const as = (u: string, init: RequestInit = {}): RequestInit => ({ ...init, headers: { ...(init.headers as object), "x-test-user": u } });
export const json = (method: string, body: unknown, headers: Record<string, string> = {}) =>
  ({ method, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
