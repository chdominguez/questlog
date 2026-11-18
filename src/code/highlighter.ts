import { createHighlighterCore, type ThemedToken } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { CodeLang } from "../course/schema";
import { isDark } from "../ui/theme";

// Fine-grained bundle: only these grammars and a light and a dark theme get shipped.
const highlighter = createHighlighterCore({
  themes: [import("shiki/themes/github-light.mjs"), import("shiki/themes/github-dark.mjs")],
  langs: [
    import("shiki/langs/typescript.mjs"),
    import("shiki/langs/tsx.mjs"),
    import("shiki/langs/javascript.mjs"),
    import("shiki/langs/json.mjs"),
    import("shiki/langs/shellscript.mjs"),
    import("shiki/langs/sql.mjs"),
    import("shiki/langs/yaml.mjs"),
    import("shiki/langs/http.mjs"),
    import("shiki/langs/python.mjs"),
  ],
  engine: createJavaScriptRegexEngine(),
});

const LANG: Record<CodeLang, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", json: "json", bash: "shellscript",
  sql: "sql", yaml: "yaml", http: "http", python: "python", text: "text",
};

export async function tokenize(src: string, lang: CodeLang): Promise<ThemedToken[][]> {
  const h = await highlighter;
  // shortcut: picked per render, so open snippets keep their theme until re-rendered after an OS scheme switch.
  return h.codeToTokens(src, { lang: LANG[lang], theme: isDark() ? "github-dark" : "github-light" }).tokens;
}
