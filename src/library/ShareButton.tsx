import { useEffect, useRef, useState } from "react";
import type { UserCourseMeta } from "../../shared/api-types";
import { APP_URL } from "../../shared/brand";
import { ApiError, call } from "../api";
import { registerCourses } from "../course/registry";
import { Dialog } from "./Dialog";
import { publish, refreshMetas, share, SHARE_ACTIONS, STATUS_LABEL, STATUS_PILL, unpublish, uploadVersion, useMeta } from "./api";

/** Share and publish on the course map, owners only. */
export function ShareButton({ courseId }: { courseId: string }) {
  const m = useMeta(courseId);
  const [open, setOpen] = useState(false);
  if (!m?.mine) return null;
  return (
    <>
      <button type="button" className="btn ghost" onClick={() => { setOpen(true); void refreshMetas(); }}>Share</button>
      {open && <ShareDialog meta={m} onClose={() => setOpen(false)} />}
    </>
  );
}

const CONFIRM = {
  submit: { title: "Submit to library?", body: "Published under CC BY 4.0.", ok: "Submit" },
  private: { title: "Make private?", body: "Shared links stop working.", ok: "Make private" },
};

function ShareDialog({ meta, onClose }: { meta: UserCourseMeta; onClose: () => void }) {
  const [confirm, setConfirm] = useState<keyof typeof CONFIRM | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState("");
  const [problems, setProblems] = useState<string[] | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const run = async (f: () => Promise<unknown>) => {
    setBusy(true); setError(false); setNotice(""); setProblems(null);
    try { await f(); } catch { setError(true); } finally { setBusy(false); }
  };

  const link = `${APP_URL}/c/${meta.id}`;
  const copy = () => run(async () => {
    if (meta.status === "private") await share(meta.id);
    // No clipboard (insecure context, some webviews) throws before the promise: show the link to copy by hand.
    await Promise.resolve().then(() => navigator.clipboard.writeText(link)).then(() => {
      setCopied(true);
      setCopyFailed(false);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    }, () => setCopyFailed(true));
  });

  const download = () => run(async () => {
    const course = await call<unknown>(`/courses/${encodeURIComponent(meta.id)}`);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(course, null, 2)], { type: "application/json" }));
    a.download = `${meta.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  const upload = async (f: File) => {
    setBusy(true); setError(false); setNotice(""); setProblems(null);
    try {
      const course = JSON.parse(await f.text());
      await uploadVersion(meta.id, course);
      registerCourses([course]);
      setNotice("Course updated");
    } catch (e) {
      const p = e instanceof ApiError ? (e.body.problems as string[] | undefined) : undefined;
      if (e instanceof SyntaxError || p) setProblems(p ?? [e instanceof Error ? e.message : String(e)]);
      else setError(true);
    } finally { setBusy(false); }
  };

  if (confirm) {
    const c = CONFIRM[confirm];
    return (
      <Dialog title={c.title} onClose={() => setConfirm(null)}>
        <p>{c.body}</p>
        {error && <p className="wa-error" role="alert">Couldn't update</p>}
        <div className="wa-actions lib-end">
          <button type="button" className="btn ghost" onClick={() => setConfirm(null)}>Cancel</button>
          <button type="button" className="btn" disabled={busy}
            onClick={() => run(async () => { await (confirm === "submit" ? publish(meta.id) : unpublish(meta.id)); setConfirm(null); })}>{c.ok}</button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title="Share course" onClose={onClose}>
      <div className="lib-stack">
        <span className={STATUS_PILL[meta.status]}>{STATUS_LABEL[meta.status]}</span>
        {meta.status === "rejected" && meta.reviewNote && <p className="lib-meta">{meta.reviewNote}</p>}
        <button type="button" className="btn" disabled={busy} onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
        <span className="sr" role="status">{copied ? "Copied" : ""}</span>
        {copyFailed && (
          <>
            <p className="wa-error" role="alert">Copy failed</p>
            <input className="scr-input" readOnly value={link} aria-label="Course link" autoFocus onFocus={(e) => e.currentTarget.select()} />
          </>
        )}
        {SHARE_ACTIONS[meta.status].map((a) => (
          <button key={a} type="button" className={a === "makePrivate" ? "btn ghost" : "btn"} disabled={busy}
            onClick={() => { setError(false); setConfirm(a === "makePrivate" ? "private" : "submit"); }}>
            {a === "submit" ? "Submit to library" : a === "submitAgain" ? "Submit again" : "Make private"}
          </button>
        ))}
      </div>
      <div className="wa-actions">
        <button type="button" className="btn quiet" disabled={busy} onClick={download}>Download file</button>
        <button type="button" className="btn quiet" disabled={busy} onClick={() => file.current?.click()}>Upload new version</button>
        <input ref={file} type="file" accept=".json,application/json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
      </div>
      {notice && <p className="wa-notice" role="status">{notice}</p>}
      {error && <p className="wa-error" role="alert">Couldn't update</p>}
      {problems && (
        <details className="course-error card" role="alert">
          <summary>Invalid course</summary>
          <pre>{problems.join("\n")}</pre>
        </details>
      )}
    </Dialog>
  );
}
