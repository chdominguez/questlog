/** A Better Auth client error, or null when the request never reached the server. */
export type AuthError = { code?: string; status?: number } | null;

/** One-line message for a failed auth call (UX 2); `fallback` when nothing more specific fits. */
export function authMessage(e: AuthError, fallback: string): string {
  if (!e || !e.status) return "Couldn't connect";
  if (e.status === 429) return "Too many attempts. Wait a minute.";
  switch (e.code) {
    case "INVALID_EMAIL_OR_PASSWORD": return "Wrong email or password";
    case "EMAIL_NOT_VERIFIED": return "Email not verified";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL": return "Email already registered";
    case "PASSWORD_TOO_SHORT": return "Password needs 8+ characters";
    case "INVALID_EMAIL": return "Enter a valid email";
    case "INVALID_TOKEN":
    case "TOKEN_EXPIRED": return "Link expired";
    case "SESSION_EXPIRED": return "Sign in again first";
    default: return fallback;
  }
}

/** Runs a Better Auth client call; a thrown fetch (offline) becomes a null error. */
export async function attempt<T>(fn: () => Promise<{ data: T | null; error: AuthError | { code?: string; status: number } }>): Promise<{ data: T | null; error: AuthError | false }> {
  try {
    const { data, error } = await fn();
    return { data, error: error ? { code: error.code, status: error.status } : false };
  } catch {
    return { data: null, error: null };
  }
}

/** `?error=` that Better Auth appends to a callback URL (before the hash); read once, then removed from the address bar. */
export function takeUrlError(): string | null {
  const u = new URL(location.href);
  const e = u.searchParams.get("error");
  if (e === null) return null;
  u.searchParams.delete("error");
  history.replaceState(null, "", u.toString());
  return e;
}

export const validEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
export const PASSWORD_MIN = 8;

const FLASH = "ql.flash";
/** One status line carried to the next screen (e.g. "Account deleted" on sign-in). */
export function flash(msg?: string): string | null {
  try {
    if (msg !== undefined) { sessionStorage.setItem(FLASH, msg); return msg; }
    const m = sessionStorage.getItem(FLASH);
    sessionStorage.removeItem(FLASH);
    return m;
  } catch { return null; }
}
