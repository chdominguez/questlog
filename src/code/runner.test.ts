import { expect, test } from "vitest";
import { deepEqual, runKata } from "./runner";

test("deepEqual", () => {
  expect(deepEqual([[1, 2]], [[1, 2]])).toBe(true);
  expect(deepEqual({ a: [1] }, { a: [1] })).toBe(true);
  expect(deepEqual([1], { 0: 1 })).toBe(false);
  expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
  expect(deepEqual(NaN, NaN)).toBe(true);
  expect(deepEqual(null, {})).toBe(false);
  expect(deepEqual(0, -0)).toBe(true);
  expect(deepEqual(new Map([["a", 1]]), new Map([["a", 1]]))).toBe(true);
  expect(deepEqual(new Map([["a", 1]]), new Map([["a", 2]]))).toBe(false);
  expect(deepEqual(new Map(), new Map([["a", 1]]))).toBe(false);
  expect(deepEqual(new Set([1, 2]), new Set([2, 1]))).toBe(true);
  expect(deepEqual(new Set([1, 2]), new Set([1, 3]))).toBe(false);
  expect(deepEqual(new Set([1]), new Map([[1, 1]]))).toBe(false);
  expect(deepEqual(new Set(), {})).toBe(false);
});

test("runKata: export keywords are stripped and logs are capped", () => {
  const src = "export function f(): number { for (let i = 0; i < 1000; i++) console.log(i); return 1; }\nexport default f;";
  const [r] = runKata(src, [{ name: "t", code: "return eq(f(), 1)" }]);
  expect(r.pass).toBe(true);
  expect(r.logs).toHaveLength(201);
  expect(r.logs.at(-1)).toBe("… (truncado)");
});

test("runKata: pass, fail, throw, logs, compile error", () => {
  const src = "function add(a: number, b: number): number { console.log('sum', a + b); return a + b; }";
  const [ok, bad, boom, notEq] = runKata(src, [
    { name: "ok", code: "return eq(add(1, 2), 3)" },
    { name: "bad", code: "return eq(add(1, 2), 4)" },
    { name: "boom", code: "throw new Error('x')" },
    { name: "noEq", code: "return 3" },
  ]);
  expect(ok).toMatchObject({ pass: true, got: "3", expected: "3", logs: ["sum 3"] });
  expect(bad).toMatchObject({ pass: false, got: "3", expected: "4" });
  expect(boom.error).toBe("Error: x");
  expect(notEq.pass).toBe(false);
  const [c] = runKata("function (", [{ name: "c", code: "return eq(1, 1)" }]);
  expect(c.pass).toBe(false);
  expect(c.error).toMatch(/Compile error/);
});

test("runKata isolates state between tests", () => {
  const src = "let n = 0; function inc() { return ++n; }";
  const r = runKata(src, [{ name: "a", code: "return eq(inc(), 1)" }, { name: "b", code: "return eq(inc(), 1)" }]);
  expect(r.every((x) => x.pass)).toBe(true);
});
