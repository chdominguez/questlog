import { useRef, useState } from "react";
import { go, href } from "../ui/route";
import { getAuthClient, loadMe } from "./session";
import { AuthFrame, Field, Legal, PasswordField, SocialButtons } from "./parts";
import { attempt, authMessage, PASSWORD_MIN, validEmail } from "./messages";

const DRAFT = "ql.signup";
/** Name and email of the last sign-up, for Check your email and Change email. */
export const signupDraft = (): { name: string; email: string } => {
  try { return { name: "", email: "", ...JSON.parse(sessionStorage.getItem(DRAFT) ?? "{}") }; } catch { return { name: "", email: "" }; }
};

type Errors = Partial<Record<"name" | "email" | "password", string>>;

export function SignUpScreen({ next }: { next?: string }) {
  const [draft] = useState(signupDraft);
  const [name, setName] = useState(draft.name);
  const [email, setEmail] = useState(draft.email);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refs = { name: useRef<HTMLInputElement>(null), email: useRef<HTMLInputElement>(null), password: useRef<HTMLInputElement>(null) };

  async function submit() {
    if (busy) return;
    const e: Errors = {};
    if (!name.trim()) e.name = "Name is required";
    if (!validEmail(email)) e.email = "Enter a valid email";
    if (password.length < PASSWORD_MIN) e.password = "Password needs 8+ characters";
    setErrors(e); setError("");
    const first = (["name", "email", "password"] as const).find((k) => e[k]);
    if (first) return refs[first].current?.focus();
    setBusy(true);
    try { sessionStorage.setItem(DRAFT, JSON.stringify({ name: name.trim(), email: email.trim() })); } catch { /* storage off */ }
    const r = await attempt(async () => (await getAuthClient()).signUp.email({ name: name.trim(), email: email.trim(), password, callbackURL: `/${next ?? href.welcome()}` }));
    if (r.error !== false) {
      setBusy(false);
      const msg = authMessage(r.error, "Couldn't create account");
      if (msg === "Enter a valid email") { setErrors({ email: msg }); return refs.email.current?.focus(); }
      if (msg === "Password needs 8+ characters") { setErrors({ password: msg }); return refs.password.current?.focus(); }
      return setError(msg);
    }
    // No token means the server wants the email verified first.
    if (!(r.data as { token?: string | null } | null)?.token) return go(href.verify(next));
    await loadMe();
    go(next ?? href.welcome());
  }

  const set = (k: keyof Errors, f: (v: string) => void) => (ev: React.ChangeEvent<HTMLInputElement>) => { f(ev.target.value); setErrors((x) => ({ ...x, [k]: undefined })); };
  return (
    <AuthFrame title="Create account">
      <SocialButtons onError={setError} />
      <form className="auth-form" noValidate onSubmit={(ev) => { ev.preventDefault(); void submit(); }}>
        <Field label="Name" autoComplete="name" inputRef={refs.name} value={name} error={errors.name} onChange={set("name", setName)} />
        <Field label="Email" type="email" autoComplete="email" inputMode="email" inputRef={refs.email} value={email} error={errors.email} onChange={set("email", setEmail)} />
        <PasswordField label="Password" autoComplete="new-password" hint="8+ characters" inputRef={refs.password} value={password} error={errors.password} onChange={set("password", setPassword)} />
        {error && <p className="auth-err" role="alert">{error}</p>}
        {error === "Email already registered" && <a className="btn quiet" href={href.signin(next)}>Sign in</a>}
        <button type="submit" className="btn" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
      </form>
      <p className="auth-links">Have an account? <a href={href.signin(next)}>Sign in</a></p>
      <Legal />
    </AuthFrame>
  );
}
