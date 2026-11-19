import { expect, test } from "vitest";
import { ladder } from "./drill";

test("ladder adds one pair at a time, keeps the last two, ends with all", () => {
  expect(ladder(3)).toEqual([[0], [0, 1], [0, 1, 2]]);
  expect(ladder(4)).toEqual([[0], [0, 1], [0, 1, 2], [1, 2, 3], [0, 1, 2, 3]]);
  const ten = ladder(10);
  expect(ten).toHaveLength(11);
  expect(ten[9]).toEqual([7, 8, 9]);
  expect(ten.flat()).toHaveLength(37);
});
