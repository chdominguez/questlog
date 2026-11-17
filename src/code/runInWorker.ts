import RunnerWorker from "./runner.worker?worker";
import type { KataTest } from "../course/schema";
import type { TestResult } from "./runner";

export const TIMEOUT_MS = 2000;
export const LOAD_TIMEOUT_MS = 15000;
export const PY_LOAD_TIMEOUT_MS = 60000; // Pyodide is ~10 MB on a cold cache

/**
 * A fresh worker per run. The TIMEOUT_MS budget starts only once the worker is ready to run the code
 * ("ready" for TypeScript, "running" for Python), so a slow script load never counts against the user's code.
 * shortcut: Pyodide reloads with every worker (the browser cache makes it fast); keep one warm worker if runs feel slow.
 */
export function runInWorker(source: string, tests: KataTest[], lang: "ts" | "python" = "ts"): Promise<TestResult[]> {
  return new Promise((resolve) => {
    const w = new RunnerWorker();
    const fail = (error: string) => tests.map((t) => ({ name: t.name, pass: false, error, logs: [] }));
    const end = (r: TestResult[]) => { clearTimeout(timer); w.terminate(); resolve(r); };
    const start = () => { clearTimeout(timer); timer = setTimeout(() => end(fail("Timed out")), TIMEOUT_MS); };
    let timer = setTimeout(() => end(fail("Runner failed to load")), LOAD_TIMEOUT_MS);
    w.onmessage = (e: MessageEvent<TestResult[] | "ready" | "running">) => {
      if (e.data === "ready") {
        w.postMessage({ source, tests, lang });
        if (lang === "python") { clearTimeout(timer); timer = setTimeout(() => end(fail("Runner failed to load")), PY_LOAD_TIMEOUT_MS); }
        else start();
      } else if (e.data === "running") start();
      else end(e.data);
    };
    w.onerror = (e) => end(fail(e.message || "Worker error"));
  });
}
