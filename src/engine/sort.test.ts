import { expect, it } from "vitest";
import { gradeSort } from "./sort";

const items = [0, 0, 1, 1].map((bucket) => ({ bucket }));
it("grades all, half, fewer", () => {
  expect(gradeSort(items, [0, 0, 1, 1])).toBe("ok");
  expect(gradeSort(items, [0, 0, 0, 0])).toBe("partial");
  expect(gradeSort(items, [1, 0, 0, 0])).toBe("wrong");
});
