import { expect, test } from "vitest";
import { runPythonKata } from "./runPython";

test("runPythonKata: pass, fail, raise, print, compile error, isolation", () => {
  const src = "n = 0\ndef inc():\n    global n\n    n += 1\n    print('n', n)\n    return n";
  const [ok, bad, boom, notEq, a, b] = runPythonKata(src, [
    { name: "ok", code: "return eq(inc(), 1)" },
    { name: "bad", code: "return eq(inc(), 5)" },
    { name: "boom", code: "raise ValueError('x')" },
    { name: "noEq", code: "return 3" },
    { name: "a", code: "x = inc()\nreturn eq(x, 1)" },
    { name: "b", code: "return eq(inc(), 1)" },
  ]);
  expect(ok).toMatchObject({ pass: true, got: "1", expected: "1", logs: ["n 1"] });
  expect(bad).toMatchObject({ pass: false, got: "1", expected: "5" });
  expect(boom.error).toBe("ValueError: x");
  expect(notEq.pass).toBe(false);
  expect(a.pass && b.pass).toBe(true);
  const [c] = runPythonKata("def (", [{ name: "c", code: "return eq(1, 1)" }]);
  expect(c.pass).toBe(false);
  expect(c.error).toMatch(/^Compile error/);
});

test("runPythonKata: infinite loop is cut by the timeout", () => {
  const [r] = runPythonKata("def f():\n    while True: pass", [{ name: "t", code: "return eq(f(), 1)" }], 500);
  expect(r.pass).toBe(false);
  expect(r.error).toMatch(/python3/);
});
