import { useEffect, useState, type ChangeEvent } from "react";
import type { Profile, Reminder } from "../../shared/api-types";
import { ApiError, deleteReminder, getMe, getProfile, listReminders, saveProfile, saveReminder } from "../answers/api";
import { COURSES } from "../course/registry";
import { enablePush, pushState, timeZone, type PushState } from "../engine/push";
import { useProgress } from "../engine/store";
import { Hud } from "../engine/Hud";
import { href } from "../ui/route";
import "../answers/answers.css";
import "./screens.css";
import "./profile.css";

const FIELDS = [
  ["name", "Name", 100], ["title", "Title", 100], ["location", "Location", 100], ["link", "Link", 300],
] as const;

function Reminders() {
  const [state, setState] = useState<PushState | null>(null);
  const [mine, setMine] = useState<Record<string, Reminder>>({});
  const [failed, setFailed] = useState(false);
  const completed = useProgress().completed;

  useEffect(() => {
    pushState().then(setState);
    listReminders().then((rs) => setMine(Object.fromEntries(rs.map((r) => [r.courseId, r]))), () => {});
  }, []);

  async function enable() {
    try { setState(await enablePush()); setFailed(false); } catch { setFailed(true); }
  }
  async function set(id: string, title: string, time: string) {
    if (!time) {
      setMine(({ [id]: _, ...rest }) => rest);
      await deleteReminder(id).catch(() => setFailed(true));
      return;
    }
    const r = { courseId: id, title, time, tz: timeZone() };
    setMine((m) => ({ ...m, [id]: r }));
    await saveReminder(r).catch(() => setFailed(true));
  }

  if (!state || state === "unsupported") return null;
  return (
    <section className="profile-reminders">
      <h2>Reminders</h2>
      {state === "install" && <p className="wa-notice">Share → Add to Home Screen</p>}
      {state === "denied" && <p className="wa-notice">Notifications are blocked</p>}
      {state === "off" && <button type="button" className="btn" onClick={enable}>Enable notifications</button>}
      {failed && <p className="wa-notice" role="alert">Couldn't save</p>}
      {state === "on" && COURSES.filter((c) => !completed.includes(c.id)).map((c) => (
        <label key={c.id} className="profile-field profile-reminder">{c.title}
          <input type="time" className="scr-input" value={mine[c.id]?.time ?? ""} onChange={(e) => set(c.id, c.title, e.target.value)} />
          {mine[c.id] && <button type="button" className="btn ghost" onClick={() => set(c.id, c.title, "")}>Remove</button>}
        </label>
      ))}
    </section>
  );
}

export function ProfileScreen() {
  const [email, setEmail] = useState("");
  const [form, setForm] = useState<Profile | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([getMe(), getProfile()]).then(([me, p]) => {
      setEmail(me.user);
      setForm({ ...p, name: p.name || me.name || "" }); // Keycloak name until the user sets their own
    }, () => setError(true));
  }, []);

  const edit = (k: keyof Profile) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => f && { ...f, [k]: e.target.value });
    setNotice("");
  };

  async function save() {
    if (!form || busy) return;
    setBusy(true);
    try { setForm(await saveProfile(form)); setNotice("Saved"); }
    catch (e) { setNotice(e instanceof ApiError && e.status === 400 ? e.message : "Couldn't save"); }
    finally { setBusy(false); }
  }

  return (
    <>
    <Hud />
    <div className="scr">
      <div className="scr-head">
        <a className="back" href={href.home()} aria-label="Home">←</a>
        <h1>Profile</h1>
      </div>
      {error && <p className="scr-empty" role="alert">Couldn't load profile</p>}
      {form && (
        <form className="profile-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label className="profile-field">Email<input className="scr-input" value={email} readOnly /></label>
          {FIELDS.map(([k, label, max]) => (
            <label key={k} className="profile-field">{label}
              <input className="scr-input" maxLength={max} value={form[k]} onChange={edit(k)} />
            </label>
          ))}
          <label className="profile-field">Bio
            <textarea className="scr-input profile-bio" maxLength={2000} value={form.bio} onChange={edit("bio")} />
          </label>
          {notice && <p className="wa-notice" role="status">{notice}</p>}
          <div className="wa-actions"><button type="submit" className="btn" disabled={busy}>Save</button></div>
        </form>
      )}
      <Reminders />
    </div>
    </>
  );
}
