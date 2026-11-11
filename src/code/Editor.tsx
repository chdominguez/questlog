// Loaded with React.lazy so Monaco stays out of the main bundle.
import * as monaco from "monaco-editor";
import { Editor as MonacoEditor, loader } from "@monaco-editor/react";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import TsWorker from "monaco-editor/language/typescript/ts.worker?worker";

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
let themed = false;
function defineTheme() {
  if (themed) return;
  themed = true;
  const hex = (v: string) => v.replace("#", "");
  monaco.editor.defineTheme("quest", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: hex(css("--muted")), fontStyle: "italic" },
      { token: "keyword", foreground: hex(css("--accent")) },
      { token: "string", foreground: hex(css("--ok")) },
      { token: "number", foreground: hex(css("--gold")) },
      { token: "type", foreground: hex(css("--info")) },
    ],
    colors: {
      "editor.background": css("--bg"),
      "editor.foreground": css("--fg"),
      "editorLineNumber.foreground": css("--line"),
      "editorLineNumber.activeForeground": css("--muted"),
      "editor.lineHighlightBackground": css("--surface"),
      "editor.selectionBackground": css("--raise"),
      "editorCursor.foreground": css("--accent"),
      "editorWidget.background": css("--surface"),
      "editorWidget.border": css("--line"),
      "editorSuggestWidget.background": css("--surface"),
      "editorSuggestWidget.border": css("--line"),
      "editorSuggestWidget.selectedBackground": css("--raise"),
      "editorHoverWidget.background": css("--surface"),
      "editorHoverWidget.border": css("--line"),
      "scrollbarSlider.background": css("--raise") + "aa",
      focusBorder: css("--accent"),
    },
  });
}

export default function Editor({ path, value, onChange }: { path: string; value: string; onChange: (v: string) => void }) {
  defineTheme();
  return (
    <MonacoEditor
      height="100%"
      path={path}
      language="typescript"
      theme="quest"
      value={value}
      onChange={(v) => onChange(v ?? "")}
      loading={null}
      options={{
        fontFamily: css("--f-mono"),
        fontSize: 14,
        fontLigatures: false,
        lineHeight: 22,
        tabSize: 2,
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
