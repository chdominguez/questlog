import { marked } from "marked";
import DOMPurify from "dompurify";
import { useMemo } from "react";

// Courses can be AI-written and notes come from the user, so the HTML is sanitized.
export function Md({ text, inline = false, className = "" }: { text: string; inline?: boolean; className?: string }) {
  const html = useMemo(() => DOMPurify.sanitize((inline ? marked.parseInline(text) : marked.parse(text)) as string), [text, inline]);
  const Tag = inline ? "span" : "div";
  return <Tag className={`md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
