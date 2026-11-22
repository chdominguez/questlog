import { useState } from "react";
import { href } from "../ui/route";
import { authClient } from "./client";
import { AuthFrame, useCooldown } from "./parts";
import { signupDraft } from "./SignUpScreen";
import { attempt, authMessage } from "./messages";

export function VerifyScreen({ next }: { next?: string }) {
  const [{ email }] = useState(signupDraft);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const wait = useCooldown();

  async function resend() {
    setStatus(""); setError("");
    const r = await attempt(() => authClient.sendVerificationEmail({ email, callbackURL: `/${next ?? href.welcome()}` }));
    if (r.error !== false) return setError(authMessage(r.error, "Couldn't send email"));
    wait.start();
    setStatus("Email sent");
  }

  return (
    <AuthFrame title="Check your email">
      {email && <p>{email}</p>}
      {error && <p className="auth-err" role="alert">{error}</p>}
      {status && <p className="wa-notice" role="status">{status}</p>}
      <div className="auth-row">
        {email && (
          <button type="button" className="btn ghost" disabled={wait.left > 0} onClick={() => void resend()}>
            {wait.left > 0 ? `Resend in ${wait.label}` : "Resend email"}
          </button>
        )}
        <a className="btn quiet" href={href.signup(next)}>Change email</a>
      </div>
    </AuthFrame>
  );
}
