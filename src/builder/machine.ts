import type { BuildRequest, Job, JobEvent, JobPoll, SkillLevel } from "../../shared/api-types";
import { BUILD } from "../../shared/pricing";

export type Stage = Extract<JobEvent, { type: "stage" }>["data"]["stage"];
export type StepState = "done" | "current" | "waiting";
export interface Step { stage: Stage; state: StepState }

/** What the job screen shows, folded from polls. */
export interface JobView {
  job: Job | null;
  seq: number; // last event seen; the next poll asks for events after it
  stages: Stage[]; // stages seen, in order
  write: { done: number; of: number } | null;
  sources: number | null;
  issues: number | null; // problems in the current fix round
  title: string | null;
  levels: { id: string; title: string; status: "waiting" | "written" | "fixed" }[];
}

export const initialView: JobView = { job: null, seq: 0, stages: [], write: null, sources: null, issues: null, title: null, levels: [] };

const ORDER: Record<BuildRequest["mode"], Stage[]> = {
  topic: ["outline", "write", "validate", "save"],
  files: ["read", "outline", "write", "validate", "save"],
  web: ["research", "outline", "write", "validate", "save"],
};

export function reduce(v: JobView, poll: JobPoll): JobView {
  let n = { ...v, job: poll.job };
  for (const e of poll.events) {
    if (e.seq <= n.seq) continue;
    n = { ...n, seq: e.seq };
    if (e.type === "stage") {
      const stage = e.data.stage === "fix" ? "validate" : e.data.stage; // fixing shows under Checking
      if (!n.stages.includes(stage)) n.stages = [...n.stages, stage];
      if (e.data.stage === "write" && e.data.of !== undefined) n.write = { done: e.data.done ?? 0, of: e.data.of };
      if (e.data.stage === "save") n.issues = null;
    } else if (e.type === "sources") n.sources = e.data.count;
    else if (e.type === "outline") n = { ...n, title: e.data.title, levels: e.data.levels.map((l) => ({ ...l, status: "waiting" })) };
    else if (e.type === "level") n.levels = n.levels.map((l) => (l.id === e.data.id ? { ...l, status: e.data.status } : l));
    else if (e.type === "problems") n.issues = e.data.count;
  }
  return n;
}

/** Steps for the mode (research added when a files build fetches URLs), each done, current or waiting. */
export function steps(v: JobView): Step[] {
  const mode = v.job?.mode ?? "topic";
  const order = mode === "files" && v.stages.includes("research") ? ["research" as const, ...ORDER.files] : ORDER[mode];
  const at = Math.max(-1, ...v.stages.map((s) => order.indexOf(s)));
  const finished = v.job?.status === "done";
  return order.map((stage, i) => ({ stage, state: finished || i < at ? "done" : i === at ? "current" : "waiting" }));
}

export const STEP_LABEL: Record<Stage, string> = {
  read: "Reading files", research: "Researching", outline: "Outline", write: "Writing levels", validate: "Checking", fix: "Checking", save: "Saving",
};

// ---- build form ----

export type Mode = BuildRequest["mode"];
export interface FileRow { key: string; name: string; bytes: number; status: "uploading" | "done" | "failed"; id?: string; file?: File }
export interface Form { mode: Mode; topic: Record<"topic" | "web", string>; level: SkillLevel; url: string; files: FileRow[] }
export type FormError = { field: "topic" | "files" | "url"; message: string } | null;

export const emptyForm: Form = { mode: "topic", topic: { topic: "", web: "" }, level: "intermediate", url: "", files: [] };

const fullUrl = (u: string) => { try { return /^https?:$/.test(new URL(u).protocol); } catch { return false; } };

/** The first client-side problem on submit, or null. */
export function checkForm(f: Form): FormError {
  if (f.mode !== "files") {
    const t = f.topic[f.mode].trim();
    if (t.length > BUILD.topicMax) return { field: "topic", message: `Use ${BUILD.topicMax} characters or fewer` };
    return t.length < BUILD.topicMin ? { field: "topic", message: "Enter a topic" } : null;
  }
  if (f.url.trim() && !fullUrl(f.url.trim())) return { field: "url", message: "Enter a full URL" };
  if (!f.files.some((r) => r.status === "done") && !f.url.trim()) return { field: "files", message: "Add a file or URL" };
  return null;
}

export function toRequest(f: Form, lang: string): BuildRequest {
  if (f.mode !== "files") return { mode: f.mode, topic: f.topic[f.mode].trim(), level: f.level, lang };
  const uploads = f.files.flatMap((r) => (r.status === "done" && r.id ? [r.id] : []));
  return { mode: "files", level: f.level, lang, ...(uploads.length && { uploads }), ...(f.url.trim() && { urls: [f.url.trim()] }) };
}

/** Why a picked file cannot be added, or null. */
export function fileProblem(file: { name: string; type: string; size: number }, count: number, limits: { uploadMaxBytes: number; uploadMaxFiles: number } = BUILD): string | null {
  if (count >= limits.uploadMaxFiles) return `Up to ${limits.uploadMaxFiles} files`;
  if (!/\.(pdf|md|markdown|txt)$/i.test(file.name) && !/^(application\/pdf|text\/plain|text\/markdown)$/.test(file.type)) return "Use PDF, Markdown or text";
  if (file.size > limits.uploadMaxBytes) return `Files must be under ${Math.round(limits.uploadMaxBytes / 1024 / 1024)} MB`;
  return null;
}
