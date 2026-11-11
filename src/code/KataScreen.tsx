import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Course } from "../course/registry";
import { href } from "../ui/route";
import { Md } from "../ui/Md";
import { play } from "../audio/sfx";
import { Snippet } from "./Snippet";
import { runInWorker } from "./runInWorker";
import type { TestResult } from "./runner";
import { Hud } from "../engine/Hud";
import "../screens/screens.css";
import "./kata.css";

const Editor = lazy(() => import("./Editor"));

const draftKey = (id: string) => `ql.kata.draft.${id}`;
const solvedKey = (id: string) => `ql.kata.solved.${id}`;
const load = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const store = (k: string, v: string | null) => {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ }
};

type Tab = "tests" | "console";

type Props = { course: Course; kataId: string; onSolved?: (firstTry: boolean) => void };

// Keyed so switching katas resets all state.
export function KataScreen(props: Props) {
  return <Kata key={props.kataId} {...props} />;
}

function Kata({ course, kataId, onSolved }: Props) {
  const kata = course.katas[kataId];
  const standalone = !onSolved;
  const [code, setCode] = useState(() => load(draftKey(kataId)) ?? kata?.starter ?? "");
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<Tab>("tests");
  const [solved, setSolved] = useState(() => load(solvedKey(kataId)) === "1");
  const [askSolution, setAskSolution] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const failedSubmit = useRef(false);
  const reported = useRef(false);

  useEffect(() => {
    if (kata) store(draftKey(kataId), code === kata.starter ? null : code);
  }, [code, kataId, kata]);

  if (!kata) {
    return (
      <div className="kata">
        <a className="kata-back" href={href.map(course.id)}>← Map</a>
        <div className="card">Kata not found</div>
      </div>
    );
  }

  const run = async (submit: boolean) => {
    if (running) return;
    if (submit) play("submit");
    setRunning(true);
    const r = await runInWorker(code, submit ? [...kata.tests, ...kata.hidden] : kata.tests);
    setRunning(false);
    setResults(r);
    setSubmitted(submit);
    const allPass = r.every((x) => x.pass);
    play(allPass ? "ok" : "bad");
    if (!submit) return;
    if (!allPass) { failedSubmit.current = true; return; }
    setSolved(true);
    store(solvedKey(kataId), "1");
    if (!reported.current) {
      reported.current = true;
      onSolved?.(!failedSubmit.current && !showSolution);
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      void run(false);
    }
  };

  const passed = results?.filter((r) => r.pass).length ?? 0;
  const logs = results?.filter((r) => r.logs.length) ?? [];
  const allPass = !!results && passed === results.length;

  return (
    <>
    {standalone && <Hud />}
    <div className="kata" onKeyDownCapture={onKey}>
      {standalone && <a className="back kata-back" href={href.map(course.id)} aria-label="Map">←</a>}
      <div className="kata-grid">
        <section className="kata-left card">
          <header className="kata-head">
            <h2>{kata.title}</h2>
            <span className={`kata-diff d-${kata.difficulty}`}>
              {kata.difficulty}
            </span>
          </header>
          <Md text={kata.statement} />
          <h3 className="kata-h3">Examples</h3>
          {kata.examples.map((ex, i) => (
            <div className="kata-ex" key={i}>
              <div><span className="kata-k">Input</span><code>{ex.input}</code></div>
              <div><span className="kata-k">Output</span><code>{ex.output}</code></div>
              {ex.note && <div className="kata-note"><Md text={ex.note} inline /></div>}
            </div>
          ))}
          {solved && (
            <div className="kata-cx">
              <h3 className="kata-h3">Complexity</h3>
              <Md text={kata.complexity} />
            </div>
          )}
        </section>

        <section className="kata-right">
          <div className="kata-editor">
            <Suspense fallback={<pre className="kata-editor-fallback">{code}</pre>}>
              <Editor key={kataId} path={`file:///kata/${kataId}.ts`} value={code} onChange={setCode} />
            </Suspense>
          </div>

          <div className="kata-actions">
            <button type="button" className="btn ghost" onClick={() => run(false)} disabled={running} aria-keyshortcuts="Control+Enter Meta+Enter">
              Run
            </button>
            <button type="button" className="btn" onClick={() => run(true)} disabled={running}>Submit</button>
            <span className="kata-spacer" />
            <button type="button" className="btn ghost" onClick={() => { setCode(kata.starter); setResults(null); }} disabled={running}>
              Reset
            </button>
            {!showSolution && !askSolution && (
              <button type="button" className="btn ghost" onClick={() => setAskSolution(true)}>Show solution</button>
            )}
            {askSolution && (
              <span className="kata-confirm" role="group" aria-label="Show the solution?">
                <span>Show the solution?</span>
                <button type="button" className="btn ghost" onClick={() => { setShowSolution(true); setAskSolution(false); }}>Show</button>
                <button type="button" className="btn ghost" onClick={() => setAskSolution(false)}>Cancel</button>
              </span>
            )}
          </div>

          <div className="kata-out card">
            <div className="kata-tabs" role="tablist">
              <button type="button" role="tab" id="kt-tests" aria-controls="kp-tests" aria-selected={tab === "tests"} onClick={() => setTab("tests")}>
                Tests
              </button>
              <button type="button" role="tab" id="kt-console" aria-controls="kp-console" aria-selected={tab === "console"} onClick={() => setTab("console")}>
                Console
              </button>
              {results && (
                <span className={`kata-score ${allPass ? "ok" : "bad"}`} role="status">
                  {allPass && submitted ? "Solved" : `${passed}/${results.length}`}
                </span>
              )}
            </div>

            {tab === "tests" && (
              <div role="tabpanel" id="kp-tests" aria-labelledby="kt-tests" aria-busy={running} className="kata-panel">
                {(results ?? kata.tests.map((t) => ({ name: t.name, pending: true } as const))).map((r, i) => (
                  <TestRow key={i} r={r} />
                ))}
              </div>
            )}
            {tab === "console" && (
              <div role="tabpanel" id="kp-console" aria-labelledby="kt-console" className="kata-panel">
                {logs.length === 0 && <p className="kata-muted">No output</p>}
                {logs.map((r, i) => (
                  <div key={i} className="kata-log">
                    <div className="kata-k">{r.name}</div>
                    <pre>{r.logs.join("\n")}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {showSolution && (
        <section className="kata-solution">
          <Snippet lang="ts" src={kata.solution} title="Solution" />
        </section>
      )}
    </div>
    </>
  );
}

function TestRow({ r }: { r: TestResult | { name: string; pending: true } }) {
  if ("pending" in r) {
    return <div className="kata-test"><span className="kata-dot" aria-hidden="true" /><span>{r.name}</span></div>;
  }
  return (
    <div className={`kata-test ${r.pass ? "ok" : "bad"}`}>
      <span className="kata-dot" aria-hidden="true" />
      <span className="kata-test-name">
        <span className="sr-only">{r.pass ? "Pass: " : "Fail: "}</span>
        {r.name}
      </span>
      {!r.pass && (
        <div className="kata-test-detail">
          {r.error ? (
            <pre className="kata-err">{r.error}</pre>
          ) : (
            <>
              <div><span className="kata-k">Got</span><code>{r.got}</code></div>
              <div><span className="kata-k">Expected</span><code>{r.expected}</code></div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
