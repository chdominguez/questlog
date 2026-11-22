import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { ArrowLeft, Check, X } from "@phosphor-icons/react";
import type { BuildRequest, Job, SkillLevel, Upload } from "../../shared/api-types";
import { ApiError, newKey } from "../api";
import { useSession } from "../auth/session";
import { CostButton } from "../billing/CostButton";
import { Hud } from "../engine/Hud";
import { go, href } from "../ui/route";
import { listJobs, loadDraft, saveDraft, startBuild, uploadSource } from "./api";
import { checkForm, emptyForm, failReason, fileProblem, toRequest, type FileRow, type Form, type FormError, type Mode } from "./machine";
import "../answers/answers.css";
import "../screens/screens.css";
import "../screens/profile.css";
import "./builder.css";

export const ACTION = { topic: "course_topic", files: "course_files", web: "course_web" } as const;
const MODES: [Mode, string][] = [["topic", "Topic"], ["files", "Files"], ["web", "Web research"]];
const LEVELS: [SkillLevel, string][] = [["beginner", "Beginner"], ["intermediate", "Intermediate"], ["advanced", "Advanced"]];
const lang = () => (typeof navigator !== "undefined" && /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(navigator.language) ? navigator.language : "en");
const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

const onlineSub = (f: () => void) => { addEventListener("online", f); addEventListener("offline", f); return () => { removeEventListener("online", f); removeEventListener("offline", f); }; };
const useOnline = () => useSyncExternalStore(onlineSub, () => navigator.onLine);

/** Starts a build, then opens its job. 402 opens the top-up sheet (in call()); the form stays as it was. */
export function useStartBuild() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; suggestions?: string[] } | null>(null);
  async function start(req: BuildRequest, files?: Upload[]) {
    setBusy(true);
    setError(null);
    try {
      const { jobId } = await startBuild(req, newKey());
      saveDraft(jobId, { req, files });
      go(href.job(jobId));
    } catch (e) {
      const code = e instanceof ApiError ? e.body.code : undefined;
      if (code === "topic_too_broad") setError({ message: "Topic too broad", suggestions: (e as ApiError).body.suggestions as string[] ?? [] });
      else if (code === "job_limit" && typeof (e as ApiError).body.jobId === "string") go(href.job((e as ApiError).body.jobId as string));
      else if (code !== "insufficient_credits") setError({ message: failReason(code) ?? "Couldn't start build" });
      setBusy(false);
    }
  }
  return { busy, error, setError, start };
}

/** Free when the free course applies (topic mode). */
export function useFree(mode: Mode) {
  const c = useSession().me?.credits;
  return mode === "topic" && !!c && c.freeCourses > 0;
}

export function TopicField({ value, onChange, error, suggestions, onPick, onEnter }: {
  value: string; onChange(v: string): void; error?: string | null; suggestions?: string[]; onPick?(s: string): void; onEnter?(): void;
}) {
  const id = useId();
  return (
    <div className="build-field">
      <label className="profile-field">Topic
        <input className="scr-input" value={value} placeholder="Rust ownership and borrowing" maxLength={400} aria-invalid={!!error || undefined} aria-describedby={error ? id : undefined}
          onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter?.(); } }} />
      </label>
      {error && <p id={id} className="wa-error" role="alert">{error}</p>}
      {!!suggestions?.length && (
        <div className="build-suggestions">
          {suggestions.map((s) => <button key={s} type="button" className="tag" onClick={() => onPick?.(s)}>{s}</button>)}
        </div>
      )}
    </div>
  );
}

export function LevelField({ value, onChange }: { value: SkillLevel; onChange(v: SkillLevel): void }) {
  const name = useId();
  return (
    <fieldset className="build-levels">
      <legend>Level</legend>
      {LEVELS.map(([v, label]) => (
        <label key={v}><input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} /> {label}</label>
      ))}
    </fieldset>
  );
}

/** The cost button, or a plain disabled one while uploads run or offline. Enter elsewhere clicks it, so the confirm step still runs. */
export function BuildButton({ mode, busy, uploading, onPress }: { mode: Mode; busy: boolean; uploading?: boolean; onPress(): void }) {
  const online = useOnline();
  const free = useFree(mode);
  if (uploading || !online) return <button type="button" className="btn" disabled>{uploading ? "Uploading…" : "Offline"}</button>;
  return <CostButton action={ACTION[mode]} label="Build course" free={free} busy={busy} onPress={onPress} />;
}

/** Clicks the build button inside `el` (cost confirm included). */
export const pressBuild = (el: HTMLElement | null) => el?.querySelector<HTMLButtonElement>(".build-actions button:not(:disabled)")?.click();

function Files({ rows, setRows, url, setUrl, error, urlError, setUrlError, limits }: {
  rows: FileRow[]; setRows(f: (r: FileRow[]) => FileRow[]): void; url: string; setUrl(v: string): void;
  error: string | null; urlError: string | null; setUrlError(v: string | null): void; limits?: { uploadMaxBytes: number; uploadMaxFiles: number };
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const errId = useId(), urlErrId = useId();
  const upload = (row: FileRow) => {
    setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, status: "uploading" } : r)));
    uploadSource(row.file!).then(
      (up) => setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, status: "done", id: up.id } : r))),
      () => setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, status: "failed" } : r))),
    );
  };
  const add = (files: FileList | null) => {
    setPickError(null);
    let count = rows.length;
    for (const file of files ?? []) {
      const p = fileProblem(file, count, limits);
      if (p) { setPickError(p); continue; }
      count++;
      const row: FileRow = { key: crypto.randomUUID(), name: file.name, bytes: file.size, status: "uploading", file };
      setRows((rs) => [...rs, row]);
      upload(row);
    }
  };
  const fullUrl = (u: string) => { try { return /^https?:$/.test(new URL(u).protocol); } catch { return false; } };
  const shown = pickError ?? error;
  return (
    <>
      <div className="build-field">
        <span className="profile-field" id={`${errId}-l`}>Files</span>
        <div className="build-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files); }}>
          <button type="button" className="btn ghost" aria-describedby={shown ? errId : undefined} onClick={() => input.current?.click()}>Add files</button>
          <span>or drop here</span>
          <input ref={input} type="file" multiple hidden accept=".pdf,.md,.txt,text/markdown,text/plain,application/pdf" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </div>
        {shown && <p id={errId} className="wa-error" role="alert">{shown}</p>}
        {rows.length > 0 && (
          <ul className="build-files" aria-labelledby={`${errId}-l`}>
            {rows.map((r) => (
              <li key={r.key}>
                <span className="build-file-name">{r.name}</span>
                <span className="build-file-size">{size(r.bytes)}</span>
                {r.status === "uploading" && <span className="bar build-busy" role="progressbar" aria-label={`Uploading ${r.name}`}><span /></span>}
                {r.status === "done" && <Check weight="bold" className="build-ok" aria-label="Uploaded" />}
                {r.status === "failed" && <><span className="pill pill-bad">Upload failed</span>{r.file && <button type="button" className="btn quiet" onClick={() => upload(r)}>Retry</button>}</>}
                <button type="button" className="iconbtn" aria-label={`Remove ${r.name}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}><X aria-hidden /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="build-field">
        <label className="profile-field">URL or repo
          <input className="scr-input" type="url" inputMode="url" value={url} placeholder="https://" aria-invalid={!!urlError || undefined} aria-describedby={urlError ? urlErrId : undefined}
            onChange={(e) => { setUrl(e.target.value); setUrlError(null); }} onBlur={() => setUrlError(url.trim() && !fullUrl(url.trim()) ? "Enter a full URL" : null)} />
        </label>
        {urlError && <p id={urlErrId} className="wa-error" role="alert">{urlError}</p>}
      </div>
    </>
  );
}

function initialForm(): Form {
  const d = loadDraft(null);
  if (!d) return emptyForm;
  const r = d.req;
  return {
    ...emptyForm, mode: r.mode, level: r.level,
    ...(r.mode !== "files" ? { topic: { ...emptyForm.topic, [r.mode]: r.topic } } : {
      url: r.urls?.[0] ?? "",
      files: (d.files ?? []).map((u) => ({ key: u.id, name: u.name, bytes: u.bytes, status: "done" as const, id: u.id })),
    }),
  };
}

export function BuildScreen() {
  const [form, setForm] = useState(initialForm);
  const [fieldError, setFieldError] = useState<FormError>(null);
  const [running, setRunning] = useState<Job | null>(null);
  const { busy, error, setError, start } = useStartBuild();
  const limits = useSession().me?.limits;
  const panel = useRef<HTMLDivElement>(null);
  const h1 = useRef<HTMLHeadingElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const headId = useId();
  useEffect(() => { h1.current?.focus(); }, []);
  useEffect(() => { listJobs().then((js) => setRunning(js.find((j) => j.status === "queued" || j.status === "running") ?? null), () => {}); }, []);

  const set = (f: Partial<Form>) => { setForm((x) => ({ ...x, ...f })); setFieldError(null); setError(null); };
  const setTopic = (v: string) => set({ topic: { ...form.topic, [form.mode]: v } });
  const submit = () => {
    const p = checkForm(form);
    setFieldError(p);
    if (p) { panel.current?.querySelector<HTMLElement>(p.field === "topic" ? "input" : p.field === "url" ? "input[type=url]" : ".build-drop button")?.focus(); return; }
    start(toRequest(form, lang()), form.files.flatMap((r) => (r.status === "done" && r.id ? [{ id: r.id, name: r.name, bytes: r.bytes }] : [])));
  };
  const onTabKey = (e: KeyboardEvent, i: number) => {
    const n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? MODES.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const j = (n + MODES.length) % MODES.length;
    set({ mode: MODES[j][0] });
    tabs.current[j]?.focus();
  };
  const topicError = fieldError?.field === "topic" ? fieldError.message
    : form.mode !== "files" && form.topic[form.mode].length > 200 ? "Use 200 characters or fewer"
    : error?.suggestions ? error.message : null;
  const pick = (s: string) => { set({ topic: { ...form.topic, [form.mode]: s } }); panel.current?.querySelector<HTMLElement>(".build-actions button")?.focus(); };

  let fields: ReactNode;
  if (form.mode === "files") {
    fields = <Files rows={form.files} setRows={(f) => setForm((x) => ({ ...x, files: f(x.files) }))} url={form.url} setUrl={(url) => set({ url })} limits={limits}
      error={fieldError?.field === "files" ? fieldError.message : null} urlError={fieldError?.field === "url" ? fieldError.message : null}
      setUrlError={(m) => setFieldError(m ? { field: "url", message: m } : null)} />;
  } else {
    fields = <TopicField value={form.topic[form.mode]} onChange={setTopic} error={topicError} suggestions={error?.suggestions} onPick={pick} onEnter={() => pressBuild(panel.current)} />;
  }

  return (
    <>
      <Hud />
      <div className="scr build">
        <div className="scr-head">
          <a className="back" href={href.home()} aria-label="Courses"><ArrowLeft aria-hidden /></a>
          <h1 id={headId} ref={h1} tabIndex={-1}>New course</h1>
        </div>
        {running && (
          <div className="card build-running">
            <span>{running.title || "Course"} · Building</span>
            <a className="btn ghost" href={href.job(running.id)}>View</a>
          </div>
        )}
        <div className="build-tabs" role="tablist" aria-labelledby={headId}>
          {MODES.map(([m, label], i) => (
            <button key={m} ref={(el) => { tabs.current[i] = el; }} type="button" role="tab" id={`build-tab-${m}`} aria-selected={form.mode === m} aria-controls="build-panel"
              tabIndex={form.mode === m ? 0 : -1} className={form.mode === m ? "btn" : "btn ghost"} onClick={() => set({ mode: m })} onKeyDown={(e) => onTabKey(e, i)}>{label}</button>
          ))}
        </div>
        <div ref={panel} className="card build-form" role="tabpanel" id="build-panel" aria-labelledby={`build-tab-${form.mode}`}>
          {fields}
          <LevelField value={form.level} onChange={(level) => set({ level })} />
          <div className="build-actions">
            <BuildButton mode={form.mode} busy={busy} uploading={form.mode === "files" && form.files.some((r) => r.status === "uploading")} onPress={submit} />
          </div>
          {error && !error.suggestions && <p className="wa-error" role="alert">{error.message}</p>}
        </div>
      </div>
    </>
  );
}
