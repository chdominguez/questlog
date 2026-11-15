import { expect, test } from "vitest";
import { resolve } from "./registry";
import { CourseSchema } from "./schema";

const course = (blocks: unknown[]) => ({
  id: "m", title: "M", lang: "en",
  levels: [{ id: "l1", order: 1, title: "L", theory: [{ title: "T", blocks }], challenges: [{ id: "q", type: "quiz", prompt: "![p](media/p.png)", explain: "e", options: ["a", "b"], answer: 0 }] }],
});
const ok = (b: unknown) => CourseSchema.safeParse(course([b]));

test("media blocks validate and resolve to public URLs", () => {
  const r = ok({ kind: "media", type: "video", src: "media/d.mp4", poster: "media/d.jpg", alt: "Demo", caption: "c" });
  expect(r.success).toBe(true);
  const c = resolve(CourseSchema.parse(course([
    { kind: "media", type: "video", src: "media/d.mp4", poster: "media/d.jpg", alt: "Demo" },
    { kind: "md", text: "x ![a](media/a.gif) ![b](https://e.com/b.png)" },
  ])));
  expect(c.levels[0].theory[0].blocks).toEqual([
    { kind: "media", type: "video", src: "/media/m/d.mp4", poster: "/media/m/d.jpg", alt: "Demo" },
    { kind: "md", text: "x ![a](/media/m/a.gif) ![b](https://e.com/b.png)" },
  ]);
  expect((c.levels[0].challenges[0] as { prompt: string }).prompt).toBe("![p](/media/m/p.png)");
});

test("media blocks reject unsafe or mismatched refs and empty alt", () => {
  const bad = [
    { type: "image", src: "../x.png", alt: "a" }, { type: "image", src: "/media/x.png", alt: "a" },
    { type: "image", src: "https://e.com/x.png", alt: "a" }, { type: "image", src: "media/x.mp4", alt: "a" },
    { type: "video", src: "media/x.gif", alt: "a" }, { type: "audio", src: "media/x.svg", alt: "a" },
    { type: "image", src: "media/a/b.png", alt: "a" }, { type: "image", src: "media/x.png", alt: "" },
    { type: "image", src: "media/x.png", alt: "a", poster: "media/y.png" }, { type: "video", src: "media/x.mp4", alt: "a", poster: "media/y.mp4" },
  ];
  for (const b of bad) expect(ok({ kind: "media", ...b }).success, JSON.stringify(b)).toBe(false);
  for (const b of [{ type: "image", src: "media/x.GIF", alt: "a" }, { type: "audio", src: "media/x.m4a", alt: "a" }]) expect(ok({ kind: "media", ...b }).success).toBe(true);
});
