import RunnerWorker from "./runner.worker?worker";
import type { KataTest } from "../course/schema";
import type { TestResult } from "./runner";

export const TIMEOUT_MS = 2000;
export const LOAD_TIMEOUT_MS = 15000;

/**
 * A fresh worker per run. The TIMEOUT_MS budget starts only once the worker says "ready",
 * so a slow script load (cold cache, SSH tunnel) never counts against the user's code.
 */
export function runInWorker(source: string, tests: KataTest[]): Promise<TestResult[]> {
  return new Promise((resolve) => {
    const w = new RunnerWorker();
    const fail = (error: string) => tests.map((t) => ({ name: t.name, pass: false, error, logs: [] }));
    const end = (r: TestResult[]) => { clearTimeout(timer); w.terminate(); resolve(r); };
    let timer = setTimeout(() => end(fail("Runner failed to load")), LOAD_TIMEOUT_MS);
    w.onmessage = (e: MessageEvent<TestResult[] | "ready">) => {
      if (e.data !== "ready") return end(e.data);
      clearTimeout(timer);
      timer = setTimeout(() => end(fail("Timed out")), TIMEOUT_MS);
      w.postMessage({ source, tests });
    };
    w.onerror = (e) => end(fail(e.message || "Worker error"));
  });
}
