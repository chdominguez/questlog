import { useState } from "react";
import { href } from "../ui/route";
import { AuthFrame, Field } from "./parts";
import { attempt, authMessage, validEmail } from "./messages";
import { getAuthClient } from "./session";

export function ForgotScreen() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setError(""); setSent(false);
    if (!validEmail(email)) return setEmailError("Enter a valid email");
    setBusy(true);
    const r = await attempt(async () => (await getAuthClient()).requestPasswordReset({ email: email.trim(), redirectTo: "/#/reset" }));
    setBusy(false);
    // Same answer whether or not the account exists.
    if (r.error === false || (r.error && r.error.status !== 429)) setSent(true);
    else setError(authMessage(r.error, "Couldn't send link"));
  }

  return (
    <AuthFrame title="Reset password">
      <form className="auth-form" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Email" type="email" autoComplete="email" inputMode="email" value={email} error={emailError}
          onChange={(e) => { setEmail(e.target.value); setEmailError(""); }} />
        {error && <p className="auth-err" role="alert">{error}</p>}
        {sent && <p className="wa-notice" role="status">Link sent</p>}
        <button type="submit" className="btn" disabled={busy}>Send link</button>
      </form>
      <p className="auth-links">Have an account? <a href={href.signin()}>Sign in</a></p>
    </AuthFrame>
  );
}
