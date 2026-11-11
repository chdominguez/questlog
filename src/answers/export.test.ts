import { expect, test } from "vitest";
import type { SavedAnswer } from "../../shared/api-types";
import { toMarkdown } from "./export";

const a = (id: string, challengeId: string, levelId: string, prompt: string, createdAt: string, extra: Partial<SavedAnswer> = {}): SavedAnswer =>
  ({ id, challengeId, levelId, prompt, answer: `resp ${id}`, source: "typed", createdAt, ...extra });

test("groups by level title, uses the prompt as heading, oldest attempt first, custom date", () => {
  const newestFirst = [
    a("3", "c2", "l2", "¿Qué es Z?", "2026-11-10T12:00:00Z", { selfScore: 6 }),
    a("2", "c1", "l1", "¿Qué es X?\n\n```ts\nx()\n```", "2026-11-10T11:00:00Z", { grade: { score: 8, covered: [], missing: ["m"], mistakes: [], improved: "mejor" } }),
    a("1", "c1", "l1", "¿Qué es X?\n\n```ts\nx()\n```", "2026-11-10T10:00:00Z", { source: "dictated" }),
  ];
  const md = toMarkdown(newestFirst, [{ id: "l1", title: "Uno" }, { id: "l2", title: "Dos" }], (iso) => `T${iso.slice(11, 13)}`);
  expect(md.indexOf("## Uno")).toBeLessThan(md.indexOf("## Dos"));
  expect(md).toContain("### ¿Qué es X?\n\n```ts\nx()\n```");
  expect(md.indexOf("resp 1")).toBeLessThan(md.indexOf("resp 2"));
  expect(md).toContain("#### T10 · dictated · ungraded");
  expect(md).toContain("#### T11 · typed · 8/10");
  expect(md).toContain("#### T12 · typed · 6/10 (self-rated)");
  expect(md).toContain("- m");
});
