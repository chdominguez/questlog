import { expect, test } from "vitest";
import { chunks, narrationText, plainText } from "./narration";

test("plainText strips Markdown and replaces code fences", () => {
  expect(plainText("# Title\n\n- **bold** and _it_ with `x`\n\n```ts\nconst a = 1;\n```\n\nSee [docs](https://x.y) ![a cat](c.png)"))
    .toBe("Title\n\nbold and it with x\n\nCode example.\n\nSee docs a cat");
});

test("narrationText reads titles, prose, captions and alts; skips practice", () => {
  expect(narrationText({
    title: "Card",
    blocks: [
      { kind: "md", text: "Hello *world*." },
      { kind: "mermaid", src: "graph", caption: "Flow of data" },
      { kind: "media", type: "image", src: "media/a.png", alt: "A diagram" },
      { kind: "drill", pairs: [{ left: "a", right: "1" }, { left: "b", right: "2" }, { left: "c", right: "3" }] },
    ],
  })).toBe("Card\n\nHello world.\n\nDiagram. Flow of data\n\nA diagram");
});

test("chunks splits on paragraphs, then sentences, never over max", () => {
  expect(chunks("short")).toEqual(["short"]);
  expect(chunks("aaaa\n\nbbbb\n\ncc", 10)).toEqual(["aaaa\n\nbbbb", "cc"]);
  expect(chunks("One one. Two two. Three.", 10)).toEqual(["One one.", "Two two.", "Three."]);
  expect(chunks("x".repeat(25), 10)).toEqual(["x".repeat(10), "x".repeat(10), "x".repeat(5)]);
});
