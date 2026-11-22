import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import type { Challenge } from "../course/schema";

vi.mock("../ui/Md", () => ({ Md: ({ text }: { text: string }) => text })); // DOMPurify needs a DOM
const { ChallengeBody, kicker } = await import("./Challenge");

const tf = { id: "c:tf", type: "multi", prompt: "P", options: ["True", "False"], answers: [1], style: "truefalse" } as Challenge;

test("true/false: single choice in fixed order, not Select all", () => {
  expect(kicker(tf)).toBe("True or false");
  expect(kicker({ ...tf, style: undefined } as Challenge)).toBe("Select all");
  for (let i = 0; i < 5; i++) {
    const html = renderToStaticMarkup(createElement(ChallengeBody, { c: tf, done: false, onResult: () => {} }));
    expect(html).not.toContain("checkbox");
    expect(html.indexOf("True")).toBeLessThan(html.indexOf("False"));
  }
});

test("an empty word-bank blank has a name", () => {
  const c = { id: "c:cz", type: "cloze", prompt: "P", lang: "http", text: "HTTP/1.1 {{1}} Created", blanks: [{ answers: ["201"] }], bank: ["201", "200"] } as Challenge;
  expect(renderToStaticMarkup(createElement(ChallengeBody, { c, done: false, onResult: () => {} }))).toContain('aria-label="Blank 1"');
});
