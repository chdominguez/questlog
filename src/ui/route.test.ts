import { expect, test } from "vitest";
import { href, parse } from "./route";

test("parse", () => {
  expect(parse("")).toEqual({ name: "home" });
  expect(parse("#/c/http-basics")).toEqual({ name: "map", course: "http-basics" });
  expect(parse("#/c/x/level/01-intro")).toEqual({ name: "level", course: "x", id: "01-intro" });
  expect(parse("#/c/x/kata/two-sum")).toEqual({ name: "kata", course: "x", id: "two-sum" });
  expect(parse("#/c/x/mock")).toEqual({ name: "mock", course: "x" });
  expect(parse("#/c/x/review")).toEqual({ name: "review", course: "x" });
  expect(parse("#/c/x/answers")).toEqual({ name: "answers", course: "x" });
  expect(parse("#/c/x/notes")).toEqual({ name: "notes", course: "x" });
  expect(parse("#/c/x/notes/abc")).toEqual({ name: "notes", course: "x", id: "abc" });
  expect(parse("#/profile")).toEqual({ name: "profile" });
  expect(parse("#/nope")).toEqual({ name: "home" });
});

test("href round-trips qualified ids", () => {
  expect(parse(href.level("x", "x:01 intro"))).toEqual({ name: "level", course: "x", id: "01 intro" });
});
