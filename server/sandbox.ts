import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { compile, type TestResult } from "../src/code/runner";
import type { Kata } from "../src/course/schema";

/** Runs a kata's tests against code in an isolated child process. An empty result means the kata was not run. */
export type KataRunner = (kata: Kata, code: string) => Promise<TestResult[]>;

const KILL_MS = 5000;
const STDOUT_MAX = 1024 * 1024;

/**
 * TS katas run in `node --permission` reading only the bundled child (build:server), with an empty env, a temp cwd,
 * a 128 MB heap, 5 s wall clock and 1 MB of output. No files, processes, workers, addons or secrets.
 * shortcut: network not isolated (Node 24's permission model does not cover it), upgrade to --allow-net or a no-network namespace.
 * Python katas: schema only on the server (no python3 in the image); the client runs them through Pyodide.
 */
export function childRunner(child = resolve(process.env.KATA_CHILD ?? "dist-server/kata/kata-child.js")): KataRunner {
  return async (kata, code) => {
    if (kata.lang === "python") return [];
    const tests = [...kata.tests, ...kata.hidden];
    const fail = (error: string): TestResult[] => tests.map((t) => ({ name: t.name, pass: false, error, logs: [] }));
    let js: string;
    try { js = compile(code); } catch (e) { return fail(`Compile error. ${e instanceof Error ? e.message : String(e)}`); }
    const cwd = mkdtempSync(join(tmpdir(), "kata-"));
    try {
      return await new Promise<TestResult[]>((done) => {
        const p = spawn(process.execPath, ["--permission", `--allow-fs-read=${child}`, "--max-old-space-size=128", child], { env: {}, cwd, stdio: ["pipe", "pipe", "ignore"] });
        let out = "";
        let why = "";
        const stop = (reason: string) => { why ||= reason; p.kill("SIGKILL"); };
        const timer = setTimeout(() => stop("Timed out"), KILL_MS);
        p.stdout.setEncoding("utf8").on("data", (d: string) => { out += d; if (out.length > STDOUT_MAX) stop("Output too large"); });
        p.on("error", () => stop("Sandbox failed"));
        p.on("close", (status) => {
          clearTimeout(timer);
          if (why) return done(fail(why));
          try {
            const r = JSON.parse(out) as TestResult[];
            if (status === 0 && Array.isArray(r) && r.length === tests.length) return done(r);
          } catch { /* fall through */ }
          done(fail("Kata run failed"));
        });
        p.stdin.on("error", () => {}); // child may die before reading
        p.stdin.end(JSON.stringify({ js, tests }));
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  };
}

export const sandboxRun: KataRunner = childRunner();
