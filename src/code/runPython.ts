import { spawnSync } from "node:child_process";
import { PY_HARNESS } from "./pyHarness";
import type { KataTest } from "../course/schema";
import type { TestResult } from "./runner";

/** Node-only twin of the browser's Pyodide run (validator and tests): same harness, host `python3`. */
export function runPythonKata(source: string, tests: KataTest[], timeoutMs = 10000): TestResult[] {
  const fail = (error: string) => tests.map((t) => ({ name: t.name, pass: false, error, logs: [] }));
  const driver = `${PY_HARNESS}\nimport sys\nd = json.load(sys.stdin)\nprint(run_kata_json(d["source"], json.dumps(d["tests"])))`;
  const r = spawnSync("python3", ["-I", "-c", driver], { input: JSON.stringify({ source, tests }), timeout: timeoutMs, encoding: "utf8" });
  if (r.error) return fail(`Could not run python3: ${r.error.message}`);
  if (r.status !== 0) return fail(`python3 failed: ${r.stderr.trim() || `exit ${r.status}`}`);
  // user prints are captured per test, so the last stdout line is always the JSON result
  return JSON.parse(r.stdout.trim().split("\n").at(-1)!);
}
