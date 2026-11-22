/** Wide tables scroll inside their own box instead of widening the page. Runs on sanitized HTML. */
export const wrapTables = (html: string) => html.replace(/<table\b/g, '<div class="tbl"><table').replace(/<\/table>/g, "</table></div>");

/** One plain line for list summaries: first non-table line, markdown markers dropped. */
export const summaryLine = (md: string) =>
  (md.split("\n").find((l) => l.trim() && !/^\s*\|/.test(l)) ?? "").replace(/^\s*(#+|[-*+]|\d+\.|>)\s+/, "").trim();
