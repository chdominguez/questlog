import { expect, test } from "vitest";
import type { Job, JobEvent, JobPoll } from "../../shared/api-types";
import { checkForm, emptyForm, fileProblem, initialView, reduce, steps, toRequest, type JobView } from "./machine";

const job = (o: Partial<Job> = {}): Job => ({ id: "j", kind: "build", status: "running", title: "Rust", mode: "topic", result: null, error: null, createdAt: "", finishedAt: null, ...o });
let seq = 0;
const ev = (type: JobEvent["type"], data: object) => ({ seq: ++seq, at: "", type, data }) as JobEvent;
const poll = (events: JobEvent[], o: Partial<Job> = {}): JobPoll => ({ job: job(o), events });
const states = (v: JobView) => steps(v).map((s) => `${s.stage}:${s.state}`);

test("topic build: queued, outline, writing, checking, fixing, saving, done", () => {
  let v = reduce(initialView, poll([], { status: "queued" }));
  expect(states(v)).toEqual(["outline:waiting", "write:waiting", "validate:waiting", "save:waiting"]);
  v = reduce(v, poll([ev("stage", { stage: "outline" })]));
  expect(states(v)[0]).toBe("outline:current");
  v = reduce(v, poll([ev("outline", { title: "Rust ownership", levels: [{ id: "a", title: "A" }, { id: "b", title: "B" }] }), ev("stage", { stage: "write", done: 0, of: 2 })]));
  expect(v.title).toBe("Rust ownership");
  expect(states(v).slice(0, 2)).toEqual(["outline:done", "write:current"]);
  v = reduce(v, poll([ev("level", { id: "b", status: "written" }), ev("stage", { stage: "write", done: 1, of: 2 })]));
  expect(v.levels.map((l) => l.status)).toEqual(["waiting", "written"]);
  expect(v.write).toEqual({ done: 1, of: 2 });
  v = reduce(v, poll([ev("stage", { stage: "validate" }), ev("problems", { attempt: 1, count: 2 }), ev("stage", { stage: "fix" }), ev("level", { id: "a", status: "fixed" })]));
  expect(v.issues).toBe(2);
  expect(states(v)[2]).toBe("validate:current");
  expect(v.levels[0].status).toBe("fixed");
  v = reduce(v, poll([ev("stage", { stage: "save" })]));
  expect(v.issues).toBeNull();
  expect(states(v)).toEqual(["outline:done", "write:done", "validate:done", "save:current"]);
  v = reduce(v, poll([ev("done", { courseId: "u1-x" })], { status: "done", result: { courseId: "u1-x" } }));
  expect(steps(v).every((s) => s.state === "done")).toBe(true);
});

test("events already seen are ignored; seq advances", () => {
  const e = ev("sources", { count: 4 });
  const v = reduce(reduce(initialView, poll([e])), poll([e, ev("sources", { count: 9 })]));
  expect(v.sources).toBe(9);
  expect(v.seq).toBe(seq);
});

test("steps per mode: web researches first, files read first and research when URLs are fetched", () => {
  expect(steps(reduce(initialView, poll([], { mode: "web" }))).map((s) => s.stage)).toEqual(["research", "outline", "write", "validate", "save"]);
  expect(steps(reduce(initialView, poll([], { mode: "files" }))).map((s) => s.stage)).toEqual(["read", "outline", "write", "validate", "save"]);
  const v = reduce(initialView, poll([ev("stage", { stage: "research" }), ev("stage", { stage: "read" })], { mode: "files" }));
  expect(states(v).slice(0, 3)).toEqual(["research:done", "read:current", "outline:waiting"]);
});

test("form checks", () => {
  expect(checkForm(emptyForm)).toEqual({ field: "topic", message: "Enter a topic" });
  expect(checkForm({ ...emptyForm, topic: { topic: "x".repeat(201), web: "" } })?.message).toBe("Use 200 characters or fewer");
  expect(checkForm({ ...emptyForm, topic: { topic: "Rust", web: "" } })).toBeNull();
  expect(checkForm({ ...emptyForm, mode: "web" })?.field).toBe("topic"); // each mode keeps its own topic
  const files = { ...emptyForm, mode: "files" as const };
  expect(checkForm(files)).toEqual({ field: "files", message: "Add a file or URL" });
  expect(checkForm({ ...files, url: "github.com/x" })).toEqual({ field: "url", message: "Enter a full URL" });
  expect(checkForm({ ...files, files: [{ key: "1", name: "a.pdf", bytes: 1, status: "uploading" }] })?.field).toBe("files");
  const ready = { ...files, url: " https://github.com/a/b ", files: [{ key: "1", name: "a.pdf", bytes: 1, status: "done" as const, id: "up1" }, { key: "2", name: "b.md", bytes: 1, status: "failed" as const }] };
  expect(checkForm(ready)).toBeNull();
  expect(toRequest(ready, "en")).toEqual({ mode: "files", level: "intermediate", lang: "en", uploads: ["up1"], urls: ["https://github.com/a/b"] });
  expect(toRequest({ ...emptyForm, mode: "web", topic: { topic: "a", web: " Rust " } }, "es")).toEqual({ mode: "web", topic: "Rust", level: "intermediate", lang: "es" });
});

test("file checks", () => {
  const f = (name: string, size = 10, type = "") => ({ name, size, type });
  expect(fileProblem(f("a.pdf"), 0)).toBeNull();
  expect(fileProblem(f("notes", 10, "text/markdown"), 0)).toBeNull();
  expect(fileProblem(f("a.docx"), 0)).toBe("Use PDF, Markdown or text");
  expect(fileProblem(f("a.pdf", 21 * 1024 * 1024), 0)).toBe("Files must be under 20 MB");
  expect(fileProblem(f("a.pdf"), 10)).toBe("Up to 10 files");
});
