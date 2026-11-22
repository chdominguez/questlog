import { marked } from "marked";
import DOMPurify from "dompurify";
import { useMemo } from "react";
import { API_BASE } from "../platform";
import { localImage, wrapTables } from "./markdown";

export { summaryLine } from "./markdown";

// External links (e.g. to LeetCode) open in a new tab, so they never navigate the installed app away.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && /^https?:/i.test(node.getAttribute("href") ?? "")) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
  if (node.tagName === "IMG" && (!localImage(node.getAttribute("src") ?? "", location.href, API_BASE) || node.hasAttribute("srcset"))) {
    node.removeAttribute("src");
    node.removeAttribute("srcset");
  }
});

// Courses can be AI-written and notes come from the user, so the HTML is sanitized.
export function Md({ text, inline = false, className = "" }: { text: string; inline?: boolean; className?: string }) {
  const html = useMemo(() => wrapTables(DOMPurify.sanitize((inline ? marked.parseInline(text) : marked.parse(text)) as string)), [text, inline]);
  const Tag = inline ? "span" : "div";
  return <Tag className={`md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
