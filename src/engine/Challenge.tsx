import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Challenge } from "../course/schema";
import { Md } from "../ui/Md";
import { Snippet } from "../code/Snippet";
import { WrittenAnswer } from "../answers/WrittenAnswer";
import { KataScreen } from "../code/KataScreen";
import { play } from "../audio/sfx";
import { dispatch, getProgress, useProgress, type Result } from "./store";
import { courseById, courseOf } from "../course/registry";
import { isMilestone } from "./Hud";
import { typingTarget } from "./Theory";
import { permutation, shuffled } from "./shuffle";
import "./engine.css";

type Of<T extends Challenge["type"]> = Extract<Challenge, { type: T }>;
type Answer = (correct: boolean) => void;

const KICKER: Record<Challenge["type"], string> = {
  quiz: "Quiz", order: "Put in order", bug: "Find the bug", written: "Written answer", kata: "Kata",
};

/** Records a result in the store, plays feedback sound and returns XP gained. */
function report(c: Challenge, result: Result): number {
  const before = getProgress().xp;
  const after = dispatch({ type: "answer", id: c.id, ctype: c.type, result, now: Date.now() });
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

  const finish = (r: Result) => {
    if (done) return;
    const gained = report(c, r);
    setResult(r);
    setXp(gained);
    setFx({ kind: r === "ok" || r === "partial" ? "ok" : "bad", xp: gained, n: ++fxN.current });
  };
  const onAnswer: Answer = (ok) => finish(ok ? "ok" : "wrong");

  let body: ReactNode;
  switch (c.type) {
    case "quiz": body = <Quiz c={c} done={done} onAnswer={onAnswer} />; break;
    case "order": body = <Order c={c} done={done} onAnswer={onAnswer} />; break;
    case "bug": body = <Bug c={c} done={done} onAnswer={onAnswer} />; break;
    case "written":
      body = <WrittenAnswer challenge={c} levelId={levelId} onDone={(s) => finish(s >= 7 ? "ok" : s >= 4 ? "partial" : "miss")} />;
      break;
    case "kata":
      body = <KataScreen course={courseById(courseOf(c.id))!} kataId={c.kataId} onSolved={() => finish("ok")} />;
      break;
  }

  const orderHint = useMemo(
    () => (c.type === "order" ? c.steps.map((s, i) => `${i + 1}. ${s}`).join("\n") : ""),
    [c],
  );
  const showFeedback = done && (c.type === "quiz" || c.type === "order" || c.type === "bug" || !!c.explain);
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
