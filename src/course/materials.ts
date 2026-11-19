import type { Level, TheoryBlock } from "./schema";

export type MediaBlock = Extract<TheoryBlock, { kind: "media" }>;

/** Media blocks from every theory card, grouped by level in course order; levels without media are skipped. */
export function mediaByLevel(course: { levels: Level[] }) {
  return course.levels
    .map((level) => ({
      level,
      items: level.theory.flatMap((t) => t.blocks.filter((b): b is MediaBlock => b.kind === "media").map((block) => ({ card: t.title, block }))),
    }))
    .filter((g) => g.items.length > 0);
}
