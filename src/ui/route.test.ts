import { expect, test } from "vitest";
import { hashQuery, href, parse } from "./route";

test("parse", () => {
  expect(parse("")).toEqual({ name: "home" });
  expect(parse("#/c/http-basics")).toEqual({ name: "map", course: "http-basics" });
  expect(parse("#/c/x/level/01-intro")).toEqual({ name: "level", course: "x", id: "01-intro" });
  expect(parse("#/c/x/kata/two-sum")).toEqual({ name: "kata", course: "x", id: "two-sum" });
  expect(parse("#/c/x/mock")).toEqual({ name: "mock", course: "x" });
  expect(parse(href.arcade("x"))).toEqual({ name: "arcade", course: "x" });
  expect(parse(href.game("x", "quiz"))).toEqual({ name: "game", course: "x", game: "quiz" });
  expect(parse(href.game("x", "quiz", "x:01 intro"))).toEqual({ name: "game", course: "x", game: "quiz", level: "01 intro" });
  expect(parse("#/c/x/review")).toEqual({ name: "review", course: "x" });
  expect(parse("#/c/x/answers")).toEqual({ name: "answers", course: "x" });
  expect(parse("#/c/x/materials")).toEqual({ name: "materials", course: "x" });
  expect(parse(href.materials("x"))).toEqual({ name: "materials", course: "x" });
  expect(parse("#/c/x/notes")).toEqual({ name: "notes", course: "x" });
  expect(parse("#/c/x/notes/abc")).toEqual({ name: "notes", course: "x", id: "abc" });
  expect(parse("#/profile")).toEqual({ name: "profile" });
  expect(parse("#/nope")).toEqual({ name: "home" });
});

test("href round-trips qualified ids", () => {
  expect(parse(href.level("x", "x:01 intro"))).toEqual({ name: "level", course: "x", id: "01 intro" });
});

test("app routes and hash query", () => {
  expect(parse("#/profile/credits")).toEqual({ name: "credits" });
  expect(parse("#/signin")).toEqual({ name: "signin" });
  expect(parse(href.signin("#/c/x?y=1"))).toEqual({ name: "signin", next: "#/c/x?y=1" });
  expect(parse(href.signup("#/plans"))).toEqual({ name: "signup", next: "#/plans" });
  expect(parse(href.verify("#/plans"))).toEqual({ name: "verify", next: "#/plans" });
  expect(parse("#/signup")).toEqual({ name: "signup" });
  expect(parse("#/signin?next=%2F%2Fevil.example")).toEqual({ name: "signin" });
  expect(parse("#/reset?token=abc")).toEqual({ name: "reset", token: "abc" });
  for (const n of ["signup", "verify", "forgot", "welcome", "library"] as const) expect(parse(href[n]())).toEqual({ name: n });
  expect(parse("#/plans")).toEqual({ name: "plans", canceled: false });
  expect(parse("#/plans?canceled=1")).toEqual({ name: "plans", canceled: true });
  expect(parse(href.billingDone())).toEqual({ name: "billingDone" });
  expect(parse(href.build())).toEqual({ name: "build" });
  expect(parse(href.job("j 1"))).toEqual({ name: "job", id: "j 1" });
  expect(parse(href.adminReview())).toEqual({ name: "adminReview" });
  expect(parse("#/admin")).toEqual({ name: "home" });
  expect(parse("#/c/x/notes?q=1")).toEqual({ name: "notes", course: "x" });
  expect(hashQuery("#/plans?canceled=1&a=b").get("a")).toBe("b");
  expect(hashQuery("#/plans").toString()).toBe("");
});
