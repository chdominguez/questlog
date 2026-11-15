import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Challenge } from "../course/schema";
import { Md } from "../ui/Md";
import { Snippet } from "../code/Snippet";
import { WrittenAnswer } from "../answers/WrittenAnswer";
import { KataScreen } from "../code/KataScreen";
import { Flashcard } from "./Flashcard";
import { play } from "../audio/sfx";
import { dispatch, getProgress, useProgress, type Result } from "./store";
import { courseById, courseOf } from "../course/registry";
import { isMilestone } from "./Hud";
import { typingTarget } from "./Theory";
import { clozeParts, gradeCloze } from "./cloze";
import { gradeSort } from "./sort";
import { permutation, shuffled } from "./shuffle";
import { gradeMatch } from "./match";
import "./engine.css";

type Of<T extends Challenge["type"]> = Extract<Challenge, { type: T }>;
type Answer = (correct: boolean) => void;

const KICKER: Record<Challenge["type"], string> = {
  quiz: "Quiz", order: "Put in order", bug: "Find the bug", cloze: "Fill the blanks", written: "Written answer", kata: "Kata", match: "Match", sort: "Sort", flashcard: "Flashcard",
};

/** Records a result in the store, plays feedback sound and returns XP gained. */
function report(c: Challenge, result: Result, easy?: boolean): number {
  const before = getProgress().xp;
  const after = dispatch({ type: "answer", id: c.id, ctype: c.type, result, easy, now: Date.now() });
  if (result === "ok") play(isMilestone(after.streak) ? "streak" : "ok");
  else if (result === "partial") play("submit");
  else play("bad");
  return after.xp - before;
}

export { shuffled };

function Quiz({ c, done, onAnswer }: { c: Of<"quiz">; done: boolean; onAnswer: Answer }) {
  // Authored content keeps the right answer first; shuffle per attempt and map positions back.
  const [order] = useState(() => permutation(c.options.length));
  const [pick, setPick] = useState<number | null>(null); // original option index
  const choose = (pos: number) => {
    if (done || pick !== null) return;
    setPick(order[pos]);
    onAnswer(order[pos] === c.answer);
  };
  useEffect(() => {
    if (done) return;
    const on = (e: KeyboardEvent) => {
      if (typingTarget(e) || e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      const i = /^[1-9]$/.test(k) ? Number(k) - 1 : /^[a-z]$/.test(k) ? k.charCodeAt(0) - 97 : -1;
      if (i >= 0 && i < c.options.length) { e.preventDefault(); choose(i); }
    };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  });
  return (
    <div className="opts">
      {order.map((oi, pos) => {
        const state = pick === null ? "" : oi === c.answer ? "right" : oi === pick ? "wrong" : "";
        return (
          <button key={oi} type="button" className={`opt ${state}`} disabled={pick !== null} onClick={() => choose(pos)}>
            <span className="k" aria-hidden="true">{String.fromCharCode(65 + pos)}</span>
            <Md text={c.options[oi]} inline />
          </button>
        );
      })}
    </div>
  );
}

function Order({ c, done, onAnswer }: { c: Of<"order">; done: boolean; onAnswer: Answer }) {
  const [items, setItems] = useState(() => shuffled(c.steps.length));
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (done || to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setItems(next);
    play("click");
  };
  return (
    <>
      <ol className="order">
        {items.map((step, pos) => (
          <li key={step} draggable={!done}
            className={[drag === pos && "dragging", over === pos && "over", done && (step === pos ? "right" : "wrong")].filter(Boolean).join(" ")}
            onDragStart={(e) => { setDrag(pos); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(pos)); }}
            onDragOver={(e) => { e.preventDefault(); setOver(pos); }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); if (drag !== null) move(drag, pos); setDrag(null); setOver(null); }}
            onDragEnd={() => { setDrag(null); setOver(null); }}>
            <span className="n">{pos + 1}</span>
            <Md text={c.steps[step]} inline />
            <span className="mv">
              <button type="button" aria-label="Move up" disabled={done || pos === 0} onClick={() => move(pos, pos - 1)}>↑</button>
              <button type="button" aria-label="Move down" disabled={done || pos === items.length - 1} onClick={() => move(pos, pos + 1)}>↓</button>
            </span>
          </li>
        ))}
      </ol>
      {!done && (
        <div className="row end">
          <button type="button" className="btn" onClick={() => onAnswer(items.every((s, i) => s === i))}>Check</button>
        </div>
      )}
    </>
  );
}

function Match({ c, done, onResult }: { c: Of<"match">; done: boolean; onResult: (r: Result) => void }) {
  const n = c.pairs.length;
  const [rights] = useState(() => shuffled(n)); // display position -> pair index
  const [link, setLink] = useState<(number | null)[]>(() => Array(n).fill(null)); // left i -> right pair index
  const [sel, setSel] = useState<number | null>(null);
  const owner = (r: number) => link.indexOf(r);
  const set = (i: number, r: number | null) => setLink(link.map((x, k) => (k === i ? r : x)));
  const pickLeft = (i: number) => {
    if (done) return;
    if (link[i] !== null) { set(i, null); setSel(i); } else setSel(sel === i ? null : i);
    play("click");
  };
  const pickRight = (r: number) => {
    if (done) return;
    const o = owner(r);
    if (o >= 0) { set(o, null); return; }
    if (sel === null) return;
    set(sel, r);
    setSel(null);
    play("click");
  };
  const hue = (i: number) => ({ "--h": `${(i * 360) / n}` }) as CSSProperties;
  return (
    <>
      <div className="match">
        <div className="mcol">
          {c.pairs.map((p, i) => (
            <button key={i} type="button" style={hue(i)} aria-pressed={sel === i}
              className={["mi", link[i] !== null && "linked", sel === i && "sel", done && (link[i] === i ? "right" : "wrong")].filter(Boolean).join(" ")}
              onClick={() => pickLeft(i)}><Md text={p.left} inline /></button>
          ))}
        </div>
        <div className="mcol">
          {rights.map((r) => {
            const o = owner(r);
            return (
              <button key={r} type="button" style={o >= 0 ? hue(o) : undefined}
                className={["mi", o >= 0 && "linked", done && (o === r ? "right" : "wrong")].filter(Boolean).join(" ")}
                onClick={() => pickRight(r)}><Md text={c.pairs[r].right} inline /></button>
            );
          })}
        </div>
      </div>
      {!done && (
        <div className="row end">
          <button type="button" className="btn" disabled={link.some((r) => r === null)} onClick={() => onResult(gradeMatch(link as number[]))}>Check</button>
        </div>
      )}
    </>
  );
}

function Sort({ c, done, onResult }: { c: Of<"sort">; done: boolean; onResult: (r: Result) => void }) {
  const [pool] = useState(() => permutation(c.items.length));
  const [placed, setPlaced] = useState<(number | null)[]>(() => c.items.map(() => null));
  const [sel, setSel] = useState<number | null>(null);
  const put = (b: number) => {
    if (done || sel === null) return;
    setPlaced(placed.map((p, i) => (i === sel ? b : p)));
    setSel(null);
    play("click");
  };
  const back = (i: number) => { if (!done) setPlaced(placed.map((p, j) => (j === i ? null : p))); };
  const loose = pool.filter((i) => placed[i] === null);
  return (
    <>
      {!done && (
        <div className="sort-pool" role="group" aria-label="Items">
          {loose.map((i) => (
            <button key={i} type="button" className={`sort-item${sel === i ? " sel" : ""}`} aria-pressed={sel === i} onClick={() => setSel(sel === i ? null : i)}>
              <Md text={c.items[i].text} inline />
            </button>
          ))}
        </div>
      )}
      <div className="sort-buckets">
        {c.buckets.map((label, b) => (
          <div key={b} className="sort-bucket">
            <button type="button" className="sort-head" disabled={done || sel === null} onClick={() => put(b)}>
              <Md text={label} inline />
            </button>
            {pool.filter((i) => placed[i] === b).map((i) => {
              const bad = done && c.items[i].bucket !== b;
              return (
                <button key={i} type="button" className={`sort-item${done ? (bad ? " wrong" : " right") : ""}`} disabled={done} onClick={() => back(i)}>
                  <Md text={c.items[i].text} inline />
                  {bad && <span className="sort-fix"><Md text={c.buckets[c.items[i].bucket]} inline /></span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {!done && (
        <div className="row end">
          <button type="button" className="btn" disabled={loose.length > 0}
            onClick={() => onResult(gradeSort(c.items, placed as number[]))}>Check</button>
        </div>
      )}
    </>
  );
}

function Bug({ c, done, onAnswer }: { c: Of<"bug">; done: boolean; onAnswer: Answer }) {
  const [pick, setPick] = useState<number | null>(null);
  return (
    <div className="code-pick" role="group" aria-label="Code lines">
      {c.lines.map((line, i) => {
        const state = pick === null ? "" : i === c.answer ? "right" : i === pick ? "wrong" : "";
        return (
          <button key={i} type="button" className={state} disabled={done || pick !== null}
            onClick={() => { setPick(i); onAnswer(i === c.answer); }}>
            <span className="ln">{i + 1}</span><span>{line || " "}</span>
          </button>
        );
      })}
    </div>
  );
}

function Cloze({ c, done, onResult }: { c: Of<"cloze">; done: boolean; onResult: (r: Result) => void }) {
  const parts = useMemo(() => clozeParts(c.text), [c.text]);
  const [vals, setVals] = useState<string[]>(() => c.blanks.map(() => ""));
  const [active, setActive] = useState(0);
  const [graded, setGraded] = useState<boolean[] | null>(null);
  const set = (i: number, v: string) => setVals((p) => p.map((x, j) => (j === i ? v : x)));
  const used = (w: string) => vals.includes(w);
  const tap = (w: string) => {
    if (done || used(w)) return;
    const i = vals[active] === "" ? active : vals.indexOf("");
    if (i < 0) return;
    set(i, w);
    const next = vals.findIndex((v, j) => j !== i && v === "");
    if (next >= 0) setActive(next);
    play("click");
  };
  const check = () => {
    const g = gradeCloze(c.blanks, vals);
    setGraded(g.right);
    onResult(g.result);
  };
  const blank = (i: number) => {
    const state = graded ? (graded[i] ? "right" : "wrong") : "";
    if (c.bank) {
      return (
        <button key={i} type="button" className={`blank ${state}${active === i ? " on" : ""}`} disabled={done}
          onClick={() => (vals[i] ? set(i, "") : setActive(i))}>{vals[i] || "\u00a0"}</button>
      );
    }
    return (
      <input key={i} className={`blank ${state}`} value={vals[i]} disabled={done} size={Math.max(4, vals[i].length + 1)}
        aria-label={`Blank ${i + 1}`} autoCapitalize="off" autoCorrect="off" spellCheck={false} inputMode="text" enterKeyHint="next"
        onChange={(e) => set(i, e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !done && vals.every(Boolean)) check(); }} />
    );
  };
  const pieces = parts.map((p, k) => (typeof p === "number" ? blank(p) : c.lang ? <span key={k}>{p}</span> : <Md key={k} text={p} inline />));
  return (
    <>
      {c.lang ? <pre className="cloze code">{pieces}</pre> : <div className="cloze">{pieces}</div>}
      {c.bank && (
        <div className="chips" role="group" aria-label="Word bank">
          {c.bank.map((w, i) => <button key={i} type="button" className="chip" disabled={done || used(w)} onClick={() => tap(w)}>{w}</button>)}
        </div>
      )}
      {graded && (
        <ul className="cloze-fix">
          {c.blanks.map((b, i) => !graded[i] && <li key={i}><span className="k">{i + 1}</span><code>{b.answers[0]}</code></li>)}
        </ul>
      )}
      {!done && (
        <div className="row end">
          <button type="button" className="btn" disabled={!vals.every(Boolean)} onClick={check}>Check</button>
        </div>
      )}
    </>
  );
}

interface Fx { kind: "ok" | "bad"; xp: number; n: number }

/** One challenge: renders the right input, records the result, shows feedback and "next". */
export function ChallengeCard({ c, levelId, onNext, nextLabel = "Next" }: {
  c: Challenge; levelId: string; onNext: () => void; nextLabel?: string;
}) {
  const card = useProgress().cards[c.id];
  const queued = !!card && card.due <= Date.now();
  const [result, setResult] = useState<Result | null>(null);
  const [xp, setXp] = useState(0);
  const [fx, setFx] = useState<Fx | null>(null);
  const fxN = useRef(0);
  const done = result !== null;

  const finish = (r: Result, easy?: boolean) => {
    if (done) return;
    const gained = report(c, r, easy);
    setResult(r);
    setXp(gained);
    setFx({ kind: r === "ok" || r === "partial" ? "ok" : "bad", xp: gained, n: ++fxN.current });
  };
  const onAnswer: Answer = (ok) => finish(ok ? "ok" : "wrong");

  let body: ReactNode;
  switch (c.type) {
    case "quiz": body = <Quiz c={c} done={done} onAnswer={onAnswer} />; break;
    case "order": body = <Order c={c} done={done} onAnswer={onAnswer} />; break;
    case "match": body = <Match c={c} done={done} onResult={finish} />; break;
    case "sort": body = <Sort c={c} done={done} onResult={finish} />; break;
    case "bug": body = <Bug c={c} done={done} onAnswer={onAnswer} />; break;
    case "cloze": body = <Cloze c={c} done={done} onResult={finish} />; break;
    case "written":
      body = <WrittenAnswer challenge={c} levelId={levelId} onDone={(s) => finish(s >= 7 ? "ok" : s >= 4 ? "partial" : "miss")} />;
      break;
    case "flashcard": body = <Flashcard c={c} done={done} onRate={finish} />; break;
    case "kata":
      body = <KataScreen course={courseById(courseOf(c.id))!} kataId={c.kataId} onSolved={() => finish("ok")} />;
      break;
  }

  const orderHint = useMemo(
    () => (c.type === "order" ? c.steps.map((s, i) => `${i + 1}. ${s}`).join("\n") : ""),
    [c],
  );
  const matchHint = useMemo(() => (c.type === "match" ? c.pairs.map((p) => `${p.left} → ${p.right}`).join("\n\n") : ""), [c]);
  const showFeedback = done && c.type !== "flashcard" && (c.type === "quiz" || c.type === "order" || c.type === "bug" || c.type === "match" || c.type === "cloze" || c.type === "sort" || !!c.explain);
  const good = result === "ok";

  return (
    <article className={`qcard${fx ? ` fx-${fx.kind}` : ""}`}>
      {fx && fx.xp > 0 && <span key={fx.n} className="float-xp" aria-hidden="true">+{fx.xp} XP</span>}
      <div className="qtype">{KICKER[c.type]}</div>
      {c.type !== "written" && <Md className="qtext" text={c.prompt} />}
      {c.code && c.type !== "bug" && c.type !== "written" && <Snippet lang={c.code.lang} src={c.code.src} />}
      {body}
      {showFeedback && (
        <div role="status" className={`feedback ${good ? "ok" : result === "partial" ? "mid" : "bad"}`}>
          <strong>{good ? "Correct" : result === "partial" ? "Almost" : "Wrong"}{xp > 0 ? ` · +${xp} XP` : ""}</strong>
          {c.explain && <Md text={c.explain} />}
          {c.type === "match" && !good && <Md text={matchHint} />}
          {c.type === "order" && !good && <Md text={orderHint} />}
        </div>
      )}
      <div className="row end">
        {c.type === "kata" && !done && (
          <button type="button" className="btn ghost" onClick={() => { report(c, "miss"); onNext(); }}>Skip</button>
        )}
        {done && !queued && (
          <button type="button" className="btn ghost" onClick={() => { dispatch({ type: "markReview", id: c.id, now: Date.now() }); play("click"); }}>Review later</button>
        )}
        {done && queued && <span className="tag">In review</span>}
        {done && <button type="button" className="btn" autoFocus onClick={() => { play("click"); onNext(); }}>{nextLabel}</button>}
      </div>
    </article>
  );
}
