/** Wide tables scroll inside their own box instead of widening the page. Runs on sanitized HTML. */
export const wrapTables = (html: string) => html.replace(/<table\b/g, '<div class="tbl"><table').replace(/<\/table>/g, "</table></div>");

/** One plain line for list summaries: first non-table line, markdown markers dropped. */
export const summaryLine = (md: string) =>
  (md.split("\n").find((l) => l.trim() && !/^\s*\|/.test(l)) ?? "").replace(/^\s*(#+|[-*+]|\d+\.|>)\s+/, "").trim();

/** Images load only from this app, its API or data: URLs; a remote image in a shared course would track every reader. */
export function localImage(src: string, here: string, api: string): boolean {
  try {
    const u = new URL(src, here);
    return u.protocol === "data:" || u.origin === new URL(here).origin || (!!api && u.origin === new URL(api).origin);
  } catch { return false; }
}
