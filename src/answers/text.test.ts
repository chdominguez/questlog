import { expect, test } from "vitest";
import { average, insertAt, mmss, sourceOf } from "./text";

test("insertAt adds spaces only where needed and moves the caret", () => {
  expect(insertAt("", 0, " hola ")).toEqual({ text: "hola", pos: 4 });
  expect(insertAt("hola", 4, "mundo")).toEqual({ text: "hola mundo", pos: 10 });
  expect(insertAt("hola ", 5, "mundo")).toEqual({ text: "hola mundo", pos: 10 });
  expect(insertAt("ab", 1, "X")).toEqual({ text: "a X b", pos: 3 });
  expect(insertAt("abc", 99, "d")).toEqual({ text: "abc d", pos: 5 });
  expect(insertAt("abc", 1, "  ")).toEqual({ text: "abc", pos: 1 });
});

test("sourceOf", () => {
  expect(sourceOf(false, false)).toBe("typed");
  expect(sourceOf(true, false)).toBe("typed");
  expect(sourceOf(false, true)).toBe("dictated");
  expect(sourceOf(true, true)).toBe("mixed");
});

test("mmss and average", () => {
  expect(mmss(1800)).toBe("30:00");
  expect(mmss(9)).toBe("0:09");
  expect(mmss(-3)).toBe("0:00");
  expect(average([])).toBeNull();
  expect(average([9, 6, 2])).toBe(5.7);
});
