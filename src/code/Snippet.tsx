import { useEffect, useState } from "react";
import type { ThemedToken } from "shiki/core";
import type { CodeLang } from "../course/schema";
import "./snippet.css";

export function Snippet({ lang, src, title, highlight = [] }: { lang: CodeLang; src: string; title?: string; highlight?: number[] }) {
  const code = src.replace(/\n$/, "");
  const [tokens, setTokens] = useState<ThemedToken[][] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    setTokens(null);
    import("./highlighter")
      .then((m) => m.tokenize(code, lang))
      .then((t) => { if (live) setTokens(t); })
      .catch(() => {}); // the plain <pre> stays as fallback
    return () => { live = false; };
  }, [code, lang]);

  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }, () => {});
  };

  const lines = tokens ?? code.split("\n").map((l) => [{ content: l } as ThemedToken]);
  const hl = new Set(highlight);

  return (
    <figure className="snippet">
      <div className="snippet-bar">
        {title && <figcaption className="snippet-title">{title}</figcaption>}
        <button type="button" className="snippet-copy" onClick={copy}>
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="snippet-pre" tabIndex={0}>
        <code>
          {lines.map((line, i) => (
            <span key={i} className={hl.has(i + 1) ? "ln hl" : "ln"}>
              <span className="ln-no" aria-hidden="true">{i + 1}</span>
              <span className="ln-code">
                {line.map((t, j) => (
                  <span
                    key={j}
                    style={t.color ? {
                      color: t.color,
                      fontStyle: (t.fontStyle ?? 0) & 1 ? "italic" : undefined,
                      fontWeight: (t.fontStyle ?? 0) & 2 ? 600 : undefined,
                    } : undefined}
                  >
                    {t.content}
                  </span>
                ))}
                {"\n"}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
