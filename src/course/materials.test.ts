import { expect, test } from "vitest";
import { mediaByLevel } from "./materials";
import type { Level } from "./schema";

const img = { kind: "media", type: "image", src: "/media/m/a.png", alt: "A" } as const;
const vid = { kind: "media", type: "video", src: "/media/m/b.mp4", alt: "B" } as const;
const aud = { kind: "media", type: "audio", src: "/media/m/c.mp3", alt: "C" } as const;
const md = { kind: "md", text: "x" } as const;
const level = (id: string, theory: Level["theory"]) => ({ id, order: 1, title: id.toUpperCase(), theory, challenges: [] }) as unknown as Level;

test("groups media blocks by level in course order, skipping levels without media", () => {
  const g = mediaByLevel({ levels: [
    level("l1", [{ title: "T1", blocks: [md, img] }, { title: "T2", blocks: [vid, aud] }]),
    level("l2", [{ title: "T3", blocks: [md] }]),
    level("l3", [{ title: "T4", blocks: [aud] }]),
  ] });
  expect(g.map((x) => x.level.id)).toEqual(["l1", "l3"]);
  expect(g[0].items).toEqual([{ card: "T1", block: img }, { card: "T2", block: vid }, { card: "T2", block: aud }]);
  expect(g[1].items).toEqual([{ card: "T4", block: aud }]);
  expect(mediaByLevel({ levels: [level("l2", [{ title: "T", blocks: [md] }])] })).toEqual([]);
});
