import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { SITE_URL } from "../../shared/brand";
import { Questie } from "../questie/Questie";
import { apiUrl, isNative, platform } from "../platform";
import { go } from "../ui/route";
import { getAuthClient, loadMe } from "./session";
import { attempt } from "./messages";
import "./auth.css";

/** Full-page frame for the sign-in screens: mascot, focused h1, content. */
export function AuthFrame({ title, children }: { title: string; children: ReactNode }) {
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => { h.current?.focus(); }, [title]);
  return (
    <div className="auth card">
      <Questie />
      <h1 ref={h} tabIndex={-1}>{title}</h1>
      {children}
    </div>
  );
}

type FieldProps = { label: string; error?: string; hint?: string; extra?: ReactNode; inputRef?: Ref<HTMLInputElement> } & InputHTMLAttributes<HTMLInputElement>;

/** Labelled input with an optional hint and an error tied by aria-describedby. */
export function Field({ label, error, hint, extra, id, inputRef, ...input }: FieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  const describedBy = [hint && !error && `${fid}-hint`, error && `${fid}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="profile-field">
      <div className="auth-pass"><label htmlFor={fid}>{label}</label>{extra}</div>
      <input ref={inputRef} id={fid} className="scr-input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {hint && !error && <p id={`${fid}-hint`} className="auth-hint">{hint}</p>}
      {error && <p id={`${fid}-err`} className="auth-err">{error}</p>}
    </div>
  );
}

/** Password input with a Show / Hide toggle. */
export function PasswordField(props: Omit<FieldProps, "type" | "extra">) {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <Field {...props} id={id} type={show ? "text" : "password"}
      extra={<button type="button" className="btn quiet auth-show" aria-pressed={show} aria-controls={id} onClick={() => setShow((s) => !s)}>{show ? "Hide" : "Show"}</button>} />
  );
}

export function Legal() {
  return <p className="auth-legal"><a href={`${SITE_URL}/terms`}>Terms</a> · <a href={`${SITE_URL}/privacy`}>Privacy</a></p>;
}

export interface Methods { google: boolean; apple: boolean; magicLink: boolean }
let methods: Promise<Methods> | null = null;
/** What this server offers besides email and password; nothing extra when it can't be read. */
export function useMethods(): Methods | null {
  const [m, setM] = useState<Methods | null>(null);
  useEffect(() => {
    methods ??= fetch(apiUrl("/auth/methods")).then((r) => (r.ok ? r.json() : Promise.reject())).catch(() => { methods = null; return { google: false, apple: false, magicLink: false }; });
    let live = true;
    methods.then((v) => { if (live) setM(v); });
    return () => { live = false; };
  }, []);
  return m;
}

type Provider = "google" | "apple";
const NAME: Record<Provider, string> = { google: "Google", apple: "Apple" };
const PROVIDER_KEY = "ql.provider";

/** Provider used for the last web redirect, for the error shown when it comes back failed. */
export const lastProvider = (): string => { try { return NAME[sessionStorage.getItem(PROVIDER_KEY) as Provider] ?? "Google"; } catch { return "Google"; } };

/** Google and Apple buttons, then the "or" divider. Apple is not offered on Android, and comes first on iOS. */
export function SocialButtons({ next, onError }: { next?: string; onError(msg: string): void }) {
  const m = useMethods();
  const [busy, setBusy] = useState(false);
  if (!m) return null;
  const list = ([m.google && "google", m.apple && platform !== "android" && "apple"].filter(Boolean) as Provider[]);
  if (platform === "ios") list.reverse();
  if (!list.length) return null;

  async function start(provider: Provider) {
    setBusy(true);
    onError("");
    const failed = () => onError(`${NAME[provider]} sign-in failed`);
    try {
      if (isNative) {
        const t = await (await import("../native/social")).idToken(provider);
        if (!t) return; // canceled
        const r = await attempt(async () => (await getAuthClient()).signIn.social({ provider, idToken: { token: t.token, nonce: t.nonce } }));
        if (r.error !== false) return failed();
        await loadMe();
        go(next ?? "#/welcome"); // Welcome sends accounts with progress or courses on to Home
      } else {
        try { sessionStorage.setItem(PROVIDER_KEY, provider); } catch { /* storage off */ }
        const r = await attempt(async () => (await getAuthClient()).signIn.social({ provider, callbackURL: `/${next ?? "#/"}`, newUserCallbackURL: "/#/welcome", errorCallbackURL: "/#/signin" }));
        if (r.error !== false) failed();
      }
    } catch { failed(); }
    finally { setBusy(false); }
  }

  return (
    <>
      {list.map((p) => (
        <button key={p} type="button" className="btn ghost" disabled={busy} onClick={() => start(p)}>Continue with {NAME[p]}</button>
      ))}
      <div className="auth-or" aria-hidden="true">or</div>
    </>
  );
}

/** "Resend in 0:42" countdown after each send. */
export function useCooldown(seconds = 60) {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= now) return;
    const t = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(t);
  }, [until, now]);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  return { left, label: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`, start: () => { const n = Date.now(); setNow(n); setUntil(n + seconds * 1000); } };
}
