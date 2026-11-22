import { useState } from "react";
import { href } from "../ui/route";
import { authClient } from "./client";
import { AuthFrame, PasswordField } from "./parts";
import { attempt, authMessage, flash, PASSWORD_MIN, takeUrlError } from "./messages";

/** The token comes from location.search (Better Auth appends ?token=), else the hash query. */
export function ResetScreen({ token: hashToken }: { token?: string }) {
  const [token] = useState(() => new URLSearchParams(location.search).get("token") ?? hashToken ?? "");
  const [expired, setExpired] = useState(() => !!takeUrlError() || !token);
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setError("");
    if (password.length < PASSWORD_MIN) return setFieldError("Password needs 8+ characters");
    setBusy(true);
    const r = await attempt(() => authClient.resetPassword({ newPassword: password, token }));
    setBusy(false);
    if (r.error !== false) {
      const msg = authMessage(r.error, "Couldn't save password");
      return msg === "Link expired" ? setExpired(true) : setError(msg);
    }
    // Reset does not sign in. Replacing the URL also drops ?token= from the address bar.
    flash("Password saved");
    location.replace(`${location.pathname}${href.signin()}`);
  }

  return (
    <AuthFrame title="New password">
      {expired ? (
        <>
          <p className="auth-err" role="alert">Link expired</p>
          <a className="btn" href={href.forgot()}>Send new link</a>
        </>
      ) : (
        <form className="auth-form" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <PasswordField label="Password" autoComplete="new-password" hint="8+ characters" value={password} error={fieldError}
            onChange={(e) => { setPassword(e.target.value); setFieldError(""); }} />
          {error && <p className="auth-err" role="alert">{error}</p>}
          <button type="submit" className="btn" disabled={busy}>Save password</button>
        </form>
      )}
    </AuthFrame>
  );
}
