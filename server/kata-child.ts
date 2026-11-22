// Sandboxed kata runner, spawned by server/sandbox.ts under `node --permission` with only this (bundled) file readable and an
// empty env. Reads { js, tests } on stdin, writes TestResult[] on stdout.
import { runInNewContext } from "node:vm";
import { deepEqual, show, MAX_LOGS, type TestResult } from "../src/code/runner";

const g = globalThis as Record<string, unknown>;
delete g.fetch;
delete g.WebSocket;

const eq = (got: unknown, expected: unknown) => ({ pass: deepEqual(got, expected), got, expected });
const message = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

function run(js: string, t: { name: string; code: string }): TestResult {
  const logs: string[] = [];
  const log = (...args: unknown[]) => {
    if (logs.length < MAX_LOGS) logs.push(args.map((a) => (typeof a === "string" ? a : show(a))).join(" "));
  };
  const console = { log, info: log, warn: log, error: log, debug: log };
  try {
    const r = runInNewContext(`"use strict";\n${js}\n;(() => {\n${t.code}\n})();`, { eq, console }, { timeout: 2000 });
    if (!r || typeof r !== "object" || !("pass" in r)) return { name: t.name, pass: false, error: "Test did not return eq(...)", logs };
    return { name: t.name, pass: !!r.pass, got: show(r.got), expected: show(r.expected), logs };
  } catch (e) {
    return { name: t.name, pass: false, error: message(e), logs };
  }
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => { input += d; });
process.stdin.on("end", () => {
  const { js, tests } = JSON.parse(input) as { js: string; tests: { name: string; code: string }[] };
  process.stdout.write(JSON.stringify(tests.map((t) => run(js, t))));
});
