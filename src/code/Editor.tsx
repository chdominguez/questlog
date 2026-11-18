// Loaded with React.lazy so Monaco stays out of the main bundle.
import * as monaco from "monaco-editor";
import { Editor as MonacoEditor, loader } from "@monaco-editor/react";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import TsWorker from "monaco-editor/language/typescript/ts.worker?worker";
import { token } from "../ui/theme";

self.MonacoEnvironment = {
  getWorker: (_id, label) => (label === "typescript" || label === "javascript" ? new TsWorker() : new EditorWorker()),
};
loader.config({ monaco });

const ts = monaco.typescript;
ts.typescriptDefaults.setCompilerOptions({
  target: ts.ScriptTarget.ESNext,
  strict: true,
  allowNonTsExtensions: true,
  moduleDetection: 3, // "force": each kata file is its own module, so names never clash across models
});
ts.typescriptDefaults.addExtraLib(
  "declare function eq(got: unknown, expected: unknown): { pass: boolean; got: unknown; expected: unknown };",
  "file:///kata-globals.d.ts",
);

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const scheme = matchMedia("(prefers-color-scheme: dark)");
// Re-read the tokens when the OS scheme flips; setTheme repaints open editors.
scheme.addEventListener("change", () => { defineTheme(); monaco.editor.setTheme("quest"); });
function defineTheme() {
  const hex = (v: string) => v.replace("#", "");
  monaco.editor.defineTheme("quest", {
    base: scheme.matches ? "vs-dark" : "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: hex(token("--muted")), fontStyle: "italic" },
      { token: "keyword", foreground: hex(token("--accent")) },
      { token: "string", foreground: hex(token("--ok")) },
      { token: "number", foreground: hex(token("--gold")) },
      { token: "type", foreground: hex(token("--info")) },
    ],
    colors: {
      "editor.background": token("--bg"),
      "editor.foreground": token("--fg"),
      "editorLineNumber.foreground": token("--line"),
      "editorLineNumber.activeForeground": token("--muted"),
      "editor.lineHighlightBackground": token("--surface"),
      "editor.selectionBackground": token("--raise"),
      "editorCursor.foreground": token("--accent"),
      "editorWidget.background": token("--surface"),
      "editorWidget.border": token("--line"),
      "editorSuggestWidget.background": token("--surface"),
      "editorSuggestWidget.border": token("--line"),
      "editorSuggestWidget.selectedBackground": token("--raise"),
      "editorHoverWidget.background": token("--surface"),
      "editorHoverWidget.border": token("--line"),
      "scrollbarSlider.background": token("--raise") + "aa",
      focusBorder: token("--accent"),
    },
  });
}
defineTheme();

export default function Editor({ path, value, onChange, language = "typescript" }: { path: string; value: string; onChange: (v: string) => void; language?: "typescript" | "python" }) {
  return (
    <MonacoEditor
      height="100%"
      path={path}
      language={language}
      theme="quest"
      value={value}
      onChange={(v) => onChange(v ?? "")}
      loading={null}
      options={{
        fontFamily: css("--f-mono"),
        fontSize: 14,
        fontLigatures: false,
        lineHeight: 22,
        tabSize: language === "python" ? 4 : 2,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        fixedOverflowWidgets: true,
        padding: { top: 12, bottom: 12 },
        renderLineHighlight: "line",
        lineNumbersMinChars: 3,
        folding: false,
        ariaLabel: "Code editor",
      }}
    />
  );
}
