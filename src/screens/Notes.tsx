import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { Note } from "../../shared/api-types";
import { COURSES } from "../course/registry";
import { ApiError, createNote, deleteNote, getNote, listNotes, updateNote } from "../answers/api";
import { fmtDate } from "../answers/text";
import { Hud } from "../engine/Hud";
import { Md } from "../ui/Md";
import { go, href } from "../ui/route";
import "../answers/answers.css";
import "./screens.css";
import "./notes.css";

export function NotesScreen() {
  const [all, setAll] = useState<Note[] | null>(null);
  const [shown, setShown] = useState<Note[] | null>(null);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => { listNotes().then(setAll, () => setError(true)); }, []);
  useEffect(() => {
    if (!q.trim() && !tag) { setShown(all); return; }
    let live = true;
    const t = setTimeout(() => listNotes(q.trim(), tag).then((xs) => live && setShown(xs), () => live && setError(true)), 200);
    return () => { live = false; clearTimeout(t); };
  }, [q, tag, all]);
  const tags = useMemo(() => [...new Set((all ?? []).flatMap((n) => n.tags))].sort(), [all]);

  return (
    <>
    <Hud />
    <div className="scr">
      <div className="scr-head">
        <a className="back" href={href.home()} aria-label="Home">←</a>
        <h1>Notes</h1>
        <a className="btn" href={href.notes("new")}>New note</a>
      </div>
      <input className="scr-input" type="search" placeholder="Search" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      {tags.length > 0 && (
        <div className="note-tags" role="group" aria-label="Tags">
          {tags.map((t) => (
            <button key={t} type="button" className="tag note-chip" aria-pressed={tag === t} onClick={() => setTag(tag === t ? "" : t)}>{t}</button>
          ))}
        </div>
      )}
      {error && <p className="scr-empty" role="alert">Couldn't load notes</p>}
      {shown?.length === 0 && <p className="scr-empty">No notes</p>}
      <ul className="note-list">
        {shown?.map((n) => (
          <li key={n.id}>
            <a className="card note-item" href={href.notes(n.id)}>
              <b>{n.title}</b>
              <span className="note-meta">
                {n.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                <time dateTime={n.updatedAt}>{fmtDate(n.updatedAt)}</time>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
    </>
  );
}

const splitTags = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean);

export function NoteScreen({ id }: { id: string }) {
  const isNew = id === "new";
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [body, setBody] = useState("");
  const [courseId, setCourseId] = useState("");
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">(isNew ? "ready" : "loading");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const loaded = useRef<string | null>(null);

  useEffect(() => {
    if (isNew || loaded.current === id) return; // just created: the form already holds it
    let live = true;
    getNote(id).then((n) => {
      if (!live) return;
      loaded.current = n.id;
      setTitle(n.title); setTags(n.tags.join(", ")); setBody(n.body); setCourseId(n.courseId ?? ""); setStatus("ready");
    }, (e) => live && setStatus(e instanceof ApiError && e.status === 404 ? "missing" : "error"));
    return () => { live = false; };
  }, [id, isNew]);

  async function save() {
    if (!title.trim() || busy || status !== "ready") return;
    setBusy(true);
    const input = { title, body, tags: splitTags(tags), ...(courseId && { courseId }) };
    try {
      const n = isNew ? await createNote(input) : await updateNote(id, input);
      loaded.current = n.id;
      setNotice("Saved");
      if (isNew) location.replace(href.notes(n.id));
    } catch (e) {
      setNotice(e instanceof ApiError && e.status === 400 ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveRef.current(); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  async function remove() {
    if (!confirm("Delete this note?")) return;
    try { await deleteNote(id); go(href.notes()); } catch { setNotice("Couldn't delete"); }
  }

  const edit = (set: (v: string) => void) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    set(e.target.value);
    setNotice("");
  };

  return (
    <>
    <Hud />
    <div className="scr">
      <div className="scr-head">
        <a className="back" href={href.notes()} aria-label="Notes">←</a>
        <h1>{isNew ? "New note" : "Note"}</h1>
      </div>
      {status === "missing" && <p className="scr-empty">Note not found</p>}
      {status === "error" && <p className="scr-empty" role="alert">Couldn't load note</p>}
      {status === "ready" && (
        <form className="note-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <input className="scr-input note-title" aria-label="Title" placeholder="Title" maxLength={200} value={title} onChange={edit(setTitle)} />
          <div className="note-row">
            <input className="scr-input" aria-label="Tags" placeholder="Tags, comma separated" value={tags} onChange={edit(setTags)} />
            <select className="scr-input" aria-label="Course" value={courseId} onChange={edit(setCourseId)}>
              <option value="">No course</option>
              {COURSES.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div className="note-tags" role="group" aria-label="View">
            <button type="button" className="tag note-chip" aria-pressed={!preview} onClick={() => setPreview(false)}>Edit</button>
            <button type="button" className="tag note-chip" aria-pressed={preview} onClick={() => setPreview(true)}>Preview</button>
          </div>
          {preview
            ? <div className="card note-preview"><Md text={body} /></div>
            : <textarea className="scr-input note-body" aria-label="Body" maxLength={100_000} value={body} onChange={edit(setBody)} />}
          {notice && <p className="wa-notice" role="status">{notice}</p>}
          <div className="wa-actions">
            <button type="submit" className="btn" disabled={busy || !title.trim()} aria-keyshortcuts="Control+S Meta+S">Save note</button>
            {!isNew && <button type="button" className="btn ghost" onClick={remove}>Delete note</button>}
          </div>
        </form>
      )}
    </div>
    </>
  );
}
