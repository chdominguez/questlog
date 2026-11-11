import { expect, test } from "vitest";
import { shouldRestart } from "./useDictation";

test("restarts only while the user still wants to dictate", () => {
  expect(shouldRestart(true, "", [], 10_000)).toBe(true);
  expect(shouldRestart(true, "no-speech", [], 10_000)).toBe(true);
  expect(shouldRestart(true, "network", [], 10_000)).toBe(true);
  expect(shouldRestart(false, "", [], 10_000)).toBe(false);
  for (const e of ["not-allowed", "service-not-allowed", "audio-capture"]) expect(shouldRestart(true, e, [], 10_000)).toBe(false);
});

test("stops after 3 restarts within 2 s", () => {
  expect(shouldRestart(true, "", [9_000, 9_500, 9_900], 10_000)).toBe(false);
  expect(shouldRestart(true, "", [7_000, 9_500, 9_900], 10_000)).toBe(true);
});
