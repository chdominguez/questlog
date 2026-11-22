// Pure routing for app links and push taps, kept apart from the plugins so it can be tested.

/** What an opened app link asks for: a magic-link token to verify, a hash route, or nothing. */
export function linkTarget(url: string): { token: string } | { hash: string } | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.pathname.startsWith("/api/auth/magic-link/verify")) {
    const token = u.searchParams.get("token");
    return token ? { token } : null;
  }
  const c = /^\/c\/([^/]+)\/?$/.exec(u.pathname);
  return c ? { hash: `#/c/${c[1]}` } : null;
}

/** The hash route in a push payload url ("/#/c/<course>"). */
export const pushHash = (url: unknown) => typeof url === "string" && url.includes("#") ? url.slice(url.indexOf("#")) : null;
