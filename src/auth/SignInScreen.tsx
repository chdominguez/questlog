import { useEffect, useRef, useState } from "react";
import { go, href } from "../ui/route";
import { getAuthClient, loadMe } from "./session";
import { AuthFrame, Field, Legal, PasswordField, SocialButtons, lastProvider, useMethods } from "./parts";
import { attempt, authMessage, flash, takeUrlError, validEmail } from "./messages";

/** What a `?error=` from a provider or an email link means on this screen. */
function urlMessage(code: string): string {
  const c = code.toLowerCase();
  if (c === "access_denied" || c === "user_cancelled_authorize") return ""; // provider canceled
  if (c === "invalid_token" || c === "token_expired" || c === "expired_token") return "Link expired";
  if (c === "account_not_linked") return "Use your password to sign in";
  return `${lastProvider()} sign-in failed`;
}

export function SignInScreen({ next }: { next?: string }) {
  const methods = useMethods();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [emailError, setEmailError] = useState("");
  const pass = useRef<HTMLInputElement>(null);
  const mail = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const e = takeUrlError();
    if (e) setError(urlMessage(e));
    const f = flash();
    if (f) setStatus(f);
  }, []);

  async function submit() {
    if (busy) return;
    setError(""); setStatus(""); setEmailError("");
    if (!validEmail(email)) { setEmailError("Enter a valid email"); mail.current?.focus(); return; }
    setBusy(true);
    const r = await attempt(async () => (await getAuthClient()).signIn.email({ email: email.trim(), password }));
    if (r.error !== false) {
      setBusy(false);
      setError(authMessage(r.error, "Couldn't sign in"));
      pass.current?.focus();
      return;
    }
    await loadMe();
    go(next ?? "#/");
  }

  async function resend() {
    if (!validEmail(email)) return setEmailError("Enter a valid email");
    const r = await attempt(async () => (await getAuthClient()).sendVerificationEmail({ email: email.trim(), callbackURL: "/#/welcome" }));
    if (r.error !== false) return setError(authMessage(r.error, "Couldn't send email"));
    setError(""); setStatus("Email sent");
  }

  async function magic() {
    setEmailError(""); setError(""); setStatus("");
    if (!validEmail(email)) return setEmailError("Enter a valid email");
    const r = await attempt(async () => (await getAuthClient()).signIn.magicLink({ email: email.trim(), callbackURL: `/${next ?? "#/"}`, newUserCallbackURL: "/#/welcome", errorCallbackURL: "/#/signin" }));
    if (r.error !== false) return setError(authMessage(r.error, "Couldn't send link"));
    setStatus("Link sent");
  }

  const unverified = error === "Email not verified" || error === "Link expired";
  return (
    <AuthFrame title="Sign in">
      <SocialButtons next={next} onError={setError} />
      <form className="auth-form" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Email" type="email" autoComplete="email" inputMode="email" inputRef={mail} value={email} error={emailError}
          onChange={(e) => { setEmail(e.target.value); setEmailError(""); }} />
        <PasswordField label="Password" autoComplete="current-password" enterKeyHint="go" inputRef={pass} value={password}
          onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="auth-err" role="alert">{error}</p>}
        {unverified && <button type="button" className="btn quiet" onClick={() => void resend()}>Resend email</button>}
        {status && <p className="wa-notice" role="status">{status}</p>}
        <button type="submit" className="btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        {methods?.magicLink && <button type="button" className="btn quiet" onClick={() => void magic()}>Email me a link</button>}
      </form>
      <div className="auth-links">
        <a href={href.forgot()}>Forgot password?</a>
        <a href={href.signup(next)}>Create account</a>
      </div>
      <Legal />
    </AuthFrame>
  );
}
