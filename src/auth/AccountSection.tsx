import { useEffect, useRef, useState } from "react";
import { REPO } from "../../shared/brand";
import { wipeLocal } from "../engine/sync";
import { isNative } from "../platform";
import { go, href } from "../ui/route";
import { getAuthClient, markSignedOut, signOut, useSession } from "./session";
import { setToken } from "./token";
import { Field } from "./parts";
import { attempt, authMessage, flash } from "./messages";
import "./auth.css";

const COMMIT = import.meta.env?.VITE_COMMIT ?? "dev";
const STORE = { app_store: "App Store", play_store: "Google Play" } as const;

/** Sign out, MCP token, delete account, source link. Mounted at the end of Profile. */
export function AccountSection() {
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [token, setTokenText] = useState("");
  const [error, setError] = useState("");

  async function out() {
    setBusy(true);
    await signOut();
    go(href.signin());
  }

  async function createToken() {
    setError("");
    const r = await attempt(async () => (await getAuthClient()).apiKey.create({ name: "mcp" }));
    if (r.error !== false || !r.data) return setError("Couldn't create token");
    setTokenText((r.data as { key: string }).key);
  }

  return (
    <section className="account">
      <h2>Account</h2>
      <button type="button" className="btn ghost" disabled={busy} onClick={() => void out()}>Sign out</button>
      {token
        ? <Field label="MCP token" value={token} readOnly onFocus={(e) => e.currentTarget.select()} />
        : <button type="button" className="btn quiet" onClick={() => void createToken()}>Create MCP token</button>}
      {error && <p className="auth-err" role="alert">{error}</p>}
      <button type="button" className="btn quiet danger" onClick={() => setDeleting(true)}>Delete account</button>
      <a href={`https://github.com/${REPO}${COMMIT === "dev" ? "" : `/tree/${COMMIT}`}`}>Source code</a>
      {deleting && <DeleteDialog onClose={() => setDeleting(false)} />}
    </section>
  );
}

function DeleteDialog({ onClose }: { onClose(): void }) {
  const me = useSession().me;
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const sub = me?.credits?.subscription;
  const active = sub && (sub.status === "active" || sub.status === "past_due");
  const store = active && sub.provider === "revenuecat" ? STORE[sub.store ?? "app_store"] : null;
  const busyRef = useRef(false);
  busyRef.current = busy;

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    cancel.current?.focus();
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) onClose();
      if (e.key !== "Tab" || !box.current) return;
      const f = [...box.current.querySelectorAll<HTMLElement>("button:not(:disabled), input, a[href]")];
      const i = f.indexOf(document.activeElement as HTMLElement);
      const n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
      e.preventDefault();
      f[n]?.focus();
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    addEventListener("keydown", on);
    return () => { removeEventListener("keydown", on); document.body.style.overflow = overflow; trigger?.focus(); };
  }, [onClose]);

  async function remove() {
    setBusy(true); setError("");
    const r = await attempt(async () => (await getAuthClient()).deleteUser({}));
    if (r.error !== false) {
      setBusy(false);
      return setError(r.error?.code === "SESSION_EXPIRED" ? authMessage(r.error, "") : "Couldn't delete account");
    }
    wipeLocal();
    try { localStorage.removeItem("ql.user"); } catch { /* storage off */ }
    await setToken(null);
    if (isNative) await import("../native/purchases").then((p) => p.logOut()).catch(() => {});
    markSignedOut();
    flash("Account deleted");
    go(href.signin());
  }

  async function manage() {
    const url = await import("../native/purchases").then((p) => p.managementUrl()).catch(() => null);
    if (url) open(url, "_blank");
  }

  const match = !!me && typed.trim().toLowerCase() === me.email.toLowerCase();
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="del-title" aria-describedby="del-body">
      <div ref={box} className="card account-dialog">
        <h2 id="del-title">Delete account?</h2>
        <p id="del-body">Progress, courses, answers, notes and credits are deleted. This can't be undone.</p>
        {active && sub.provider === "stripe" && <p>Your plan is canceled now.</p>}
        {store && <p>Cancel your {store} subscription first.</p>}
        {store && isNative && <button type="button" className="btn quiet" onClick={() => void manage()}>Manage</button>}
        <Field label="Type your email" type="email" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
        {error && <p className="auth-err" role="alert">{error}</p>}
        <div className="wa-actions">
          <button ref={cancel} type="button" className="btn ghost" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="button" className="btn danger-btn" disabled={!match || busy} onClick={() => void remove()}>{busy ? "Deleting…" : "Delete account"}</button>
        </div>
      </div>
    </div>
  );
}
