import type { TestResult } from "../src/code/runner";
import type { Kata } from "../src/course/schema";

/** Runs a kata's tests against code in an isolated child process. */
export type KataRunner = (kata: Kata, code: string) => Promise<TestResult[]>;

// Stub until WP5 (builder): no sandbox, so every run is rejected.
export const sandboxRun: KataRunner = async () => { throw new Error("Kata sandbox not available"); };
