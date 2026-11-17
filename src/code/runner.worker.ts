import { runKata } from "./runner";
import { PY_HARNESS } from "./pyHarness";
import type { KataTest } from "../course/schema";

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/";
type Msg = { source: string; tests: KataTest[]; lang?: "ts" | "python" };

let py: Promise<(source: string, testsJson: string) => string> | undefined;
const loadPython = () => (py ??= (async () => {
  const { loadPyodide } = await import(/* @vite-ignore */ PYODIDE + "pyodide.mjs");
  const p = await loadPyodide({ indexURL: PYODIDE });
  p.runPython(PY_HARNESS);
  return p.globals.get("run_kata_json");
})());

self.onmessage = async (e: MessageEvent<Msg>) => {
  const { source, tests, lang } = e.data;
  if (lang !== "python") return self.postMessage(runKata(source, tests));
  const run = await loadPython();
  self.postMessage("running"); // the run budget starts now, not at the Pyodide download
  self.postMessage(JSON.parse(run(source, JSON.stringify(tests))));
};
self.postMessage("ready");
