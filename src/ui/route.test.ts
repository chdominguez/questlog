import { expect, test } from "vitest";
import { href, parse } from "./route";

test("parse", () => {
  expect(parse("")).toEqual({ name: "home" });
  expect(parse("#/c/http-basics")).toEqual({ name: "map", course: "http-basics" });
  expect(parse("#/c/x/level/01-intro")).toEqual({ name: "level", course: "x", id: "01-intro" });
  expect(parse("#/c/x/kata/two-sum")).toEqual({ name: "kata", course: "x", id: "two-sum" });
  expect(parse("#/c/x/mock")).toEqual({ name: "mock", course: "x" });
  expect(parse("#/review")).toEqual({ name: "review" });
  expect(parse("#/notes/abc")).toEqual({ name: "notes", id: "abc" });
  expect(parse("#/nope")).toEqual({ name: "home" });
});

test("href round-trips qualified ids", () => {
  expect(parse(href.level("x", "x:01 intro"))).toEqual({ name: "level", course: "x", id: "01 intro" });
});
