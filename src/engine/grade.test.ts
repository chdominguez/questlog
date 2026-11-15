import { expect, test } from "vitest";
import { gradeMulti } from "./grade";

test("gradeMulti", () => {
  expect(gradeMulti([0, 2], [2, 0])).toBe("ok");
  expect(gradeMulti([0, 1, 2], [0, 1])).toBe("partial");
  expect(gradeMulti([0, 1, 2], [0])).toBe("wrong");
  expect(gradeMulti([0, 1], [0, 3])).toBe("wrong");
  expect(gradeMulti([0], [1])).toBe("wrong");
});
