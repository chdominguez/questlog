import { expect, test } from "vitest";
import { clozeParts, gradeCloze } from "./cloze";

test("parts split text and blank indexes", () => {
  expect(clozeParts("a {{1}} b {{2}}")).toEqual(["a ", 0, " b ", 1]);
});

test("grading is lenient unless exact, and partial at half", () => {
  const b = [{ answers: ["GET", "get"] }, { answers: ["A b"], exact: true }, { answers: ["x"] }, { answers: ["y"] }];
  expect(gradeCloze(b, [" get ", "A b", "X", "y"]).result).toBe("ok");
  expect(gradeCloze(b, ["GET", "a b", "x", "q"])).toEqual({ right: [true, false, true, false], result: "partial" });
  expect(gradeCloze(b, ["", "", "", "y"]).result).toBe("wrong");
});
