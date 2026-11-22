import type { Env } from "./env";

export interface Mail { to: string; subject: string; text: string }

/** Sends through Resend's HTTP API. Without RESEND_API_KEY (self-host) the mail is logged, so the link is in the server log. */
export async function sendMail(env: Env, fetchFn: typeof fetch, m: Mail): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(`[mail] to ${m.to}: ${m.subject}\n${m.text}`);
    return;
  }
  const res = await fetchFn("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM ?? "Questie <noreply@questie.app>", to: [m.to], subject: m.subject, text: m.text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text().catch(() => "")}`);
}

export const verifyMail = (to: string, url: string): Mail => ({ to, subject: "Verify your email", text: `Verify your Questie email:\n\n${url}\n` });
export const magicLinkMail = (to: string, url: string): Mail => ({ to, subject: "Sign in to Questie", text: `Sign in to Questie:\n\n${url}\n\nThe link works once and expires in 5 minutes.\n` });
export const resetMail = (to: string, url: string): Mail => ({ to, subject: "Reset your password", text: `Set a new Questie password:\n\n${url}\n\nThe link expires in 1 hour.\n` });
