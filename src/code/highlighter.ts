import { createCssVariablesTheme, createHighlighterCore, type ThemedToken } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { CodeLang } from "../course/schema";

// Token colors are CSS variables (--shiki-* in global.css), so snippets follow the palette and the OS scheme live.
const theme = createCssVariablesTheme({ name: "questie", variablePrefix: "--shiki-" });

// Fine-grained bundle: only these grammars get shipped.
const highlighter = createHighlighterCore({
  themes: [theme],
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
  return h.codeToTokens(src, { lang: LANG[lang], theme: "questie" }).tokens;
}
