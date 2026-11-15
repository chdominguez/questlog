import { expect, it } from "vitest";
import { gradeMatch } from "./match";

it("grades by number of wrong links", () => {
  expect(gradeMatch([0, 1, 2])).toBe("ok");
  expect(gradeMatch([1, 0, 2, 3, 4, 5])).toBe("partial");
  expect(gradeMatch([1, 0, 2])).toBe("wrong"); // 2 of 3 is at least half
  expect(gradeMatch([1, 2, 0, 3, 4, 5])).toBe("wrong"); // 3 wrong
  expect(gradeMatch([1, 0, 3, 2, 4, 5, 6, 7])).toBe("wrong"); // 4 wrong
});
