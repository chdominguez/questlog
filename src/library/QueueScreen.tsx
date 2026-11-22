import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import type { CourseMode, Flag, FlagReason, ReviewQueue, UserCourseMeta } from "../../shared/api-types";
import { CHALLENGES, courseById, levelByKey } from "../course/registry";
import { Hud } from "../engine/Hud";
import { href } from "../ui/route";
import { Dialog } from "./Dialog";
import { approve, getReview, reject, resolveFlag } from "./api";
import "./library.css";

const UNDO_MS = 5000;
const MODE: Record<CourseMode, string> = { topic: "Topic", files: "Files", web: "Web research", upload: "Upload" };
const REASON: Record<FlagReason, string> = { wrong: "Wrong", unclear: "Unclear", broken: "Broken", other: "Other" };
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Level title of a flagged item: a challenge id or "<level key>#<card>". */
const itemTitle = (f: Flag) => {
  if (!f.itemId) return null;
  const level = f.itemId.includes("#") ? f.itemId.slice(0, f.itemId.lastIndexOf("#")) : CHALLENGES[f.itemId]?.levelId;
  return (level && levelByKey(level)?.title) ?? f.itemId;
};

export function QueueScreen() {
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<"pending" | "reports">("pending");
  const [error, setError] = useState(false);
  const [rejecting, setRejecting] = useState<UserCourseMeta | null>(null);
  // Approvals wait UNDO_MS before the request; leaving the screen sends them at once.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [held, setHeld] = useState<UserCourseMeta | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    getReview().then(setQueue, () => setFailed(true));
  }, []);
  useEffect(load, [load]);
  useEffect(() => () => { for (const [id, t] of timers.current) { clearTimeout(t); approve(id).catch(() => {}); } }, []);

  const drop = (id: string) => setQueue((q) => q && { ...q, pending: q.pending.filter((m) => m.id !== id) });
  const restore = (m: UserCourseMeta) => setQueue((q) => q && { ...q, pending: [m, ...q.pending.filter((x) => x.id !== m.id)] });

  const startApprove = (m: UserCourseMeta) => {
    setError(false);
    drop(m.id);
    setHeld(m);
    timers.current.set(m.id, setTimeout(() => {
      timers.current.delete(m.id);
      setHeld((h) => (h?.id === m.id ? null : h));
      approve(m.id).catch(() => { restore(m); setError(true); });
    }, UNDO_MS));
  };
  const undo = (m: UserCourseMeta) => {
    clearTimeout(timers.current.get(m.id));
    timers.current.delete(m.id);
    setHeld(null);
    restore(m);
  };
  const dismiss = (f: Flag) => {
    setError(false);
    resolveFlag(f.id).then(
      () => setQueue((q) => q && { ...q, flags: q.flags.filter((x) => x.id !== f.id) }),
      () => setError(true));
  };

  return (
    <>
      <Hud />
      <div className="scr">
        <div className="scr-head">
          <a className="back" href={href.profile()} aria-label="Profile"><ArrowLeft aria-hidden /></a>
          <h1>Review queue</h1>
        </div>
        {failed && <p className="scr-empty" role="alert">Couldn't load queue <button type="button" className="btn ghost" onClick={load}>Retry</button></p>}
        {queue && (
          <>
            <div className="lib-tabs" role="tablist">
              <button type="button" role="tab" className="btn ghost" aria-selected={tab === "pending"} onClick={() => setTab("pending")}>Pending · {queue.pending.length}</button>
              <button type="button" role="tab" className="btn ghost" aria-selected={tab === "reports"} onClick={() => setTab("reports")}>Reports · {queue.flags.length}</button>
            </div>
            <div role="status">
              {held && <p className="wa-notice">Approved <button type="button" className="btn quiet" onClick={() => undo(held)}>Undo</button></p>}
            </div>
            {error && <p className="wa-error" role="alert">Couldn't update</p>}
            {tab === "pending" && (queue.pending.length ? (
              <ul className="lib-list">
                {queue.pending.map((m) => (
                  <li key={m.id} className="card lib-row">
                    <div className="lib-row-head"><b>{m.title}</b><span className="tag">{MODE[m.mode]}</span></div>
                    <span className="lib-meta">{m.author} · {day(m.updatedAt)} · {m.levels} levels{m.mode === "web" ? ` · ${m.sources} sources` : ""}</span>
                    <div className="wa-actions">
                      <a className="btn ghost" href={href.map(m.id)} target="_blank" rel="noopener">Open</a>
                      <button type="button" className="btn" onClick={() => startApprove(m)}>Approve</button>
                      <button type="button" className="btn ghost" onClick={() => { setError(false); setRejecting(m); }}>Reject</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="scr-empty">Queue empty</p>)}
            {tab === "reports" && (queue.flags.length ? (
              <ul className="lib-list">
                {queue.flags.map((f) => (
                  <li key={f.id} className="card lib-row">
                    <div className="lib-row-head">
                      <b>{courseById(f.courseId)?.title ?? f.courseId}{itemTitle(f) ? ` · ${itemTitle(f)}` : ""}</b>
                      <span className="pill">{f.count}</span>
                    </div>
                    <span className="lib-meta">{REASON[f.reason]} · {day(f.createdAt)}</span>
                    {f.text && <p>{f.text}</p>}
                    <div className="wa-actions">
                      <a className="btn ghost" href={href.map(f.courseId)} target="_blank" rel="noopener">Open</a>
                      <button type="button" className="btn ghost" onClick={() => dismiss(f)}>Dismiss</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="scr-empty">No reports</p>)}
          </>
        )}
      </div>
      {rejecting && <RejectDialog course={rejecting} onClose={() => setRejecting(null)} onDone={() => { drop(rejecting.id); setRejecting(null); }} />}
    </>
  );
}

function RejectDialog({ course, onClose, onDone }: { course: UserCourseMeta; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const send = async () => {
    setBusy(true); setError(false);
    try { await reject(course.id, note.trim()); onDone(); } catch { setError(true); setBusy(false); }
  };
  return (
    <Dialog title="Reject course?" onClose={onClose}>
      <form className="lib-stack" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <label className="lib-field">Reason
          <textarea className="scr-input" required maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p className="wa-error" role="alert">Couldn't update</p>}
        <div className="wa-actions lib-end">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!note.trim() || busy}>Reject</button>
        </div>
      </form>
    </Dialog>
  );
}
