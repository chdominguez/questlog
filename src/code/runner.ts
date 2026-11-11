import { transform } from "sucrase";
import type { KataTest } from "../course/schema";

export interface TestResult {
  name: string;
  pass: boolean;
  got?: string;
  expected?: string;
  error?: string;
  logs: string[];
}

export function show(v: unknown): string {
  if (v === undefined) return "undefined";
  if (typeof v === "function") return "[function]";
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b || (Number.isNaN(a) && Number.isNaN(b))) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (a instanceof Map || a instanceof Set || b instanceof Map || b instanceof Set) {
    if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
    const xs = [...(a as Iterable<unknown>)], ys = [...(b as Iterable<unknown>)];
    return xs.length === ys.length && xs.every((x) => ys.some((y) => deepEqual(x, y))); // order-insensitive
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.hasOwn(b, k) && deepEqual((a as any)[k], (b as any)[k]));
}

const eq = (got: unknown, expected: unknown) => ({ pass: deepEqual(got, expected), got, expected });

export const MAX_LOGS = 200;

export function compile(ts: string): string {
  // The code runs inside new Function, where `export` is a syntax error; people paste it from an IDE.
  return transform(ts.replace(/^(\s*)export\s+(default\s+)?/gm, "$1"), { transforms: ["typescript"] }).code;
}

const message = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

/** Compiles the user's TS once, then runs it fresh before each test so state never leaks between tests. */
export function runKata(source: string, tests: KataTest[]): TestResult[] {
  let js: string;
  try {
    js = compile(source);
  } catch (e) {
    const error = `Compile error. ${message(e)}`;
    return tests.map((t) => ({ name: t.name, pass: false, error, logs: [] }));
  }
  return tests.map((t) => {
    const logs: string[] = [];
    const log = (...args: unknown[]) => {
      if (logs.length < MAX_LOGS) logs.push(args.map((a) => (typeof a === "string" ? a : show(a))).join(" "));
      else if (logs.length === MAX_LOGS) logs.push("… (truncado)");
    };
    const console = { log, info: log, warn: log, error: log, debug: log };
    try {
      const fn = new Function("eq", "console", `"use strict";\n${js}\n;return (() => {\n${t.code}\n})();`);
      const r = fn(eq, console);
      if (!r || typeof r !== "object" || !("pass" in r)) return { name: t.name, pass: false, error: "Test did not return eq(...)", logs };
      return { name: t.name, pass: !!r.pass, got: show(r.got), expected: show(r.expected), logs };
    } catch (e) {
      return { name: t.name, pass: false, error: message(e), logs };
    }
  });
}
