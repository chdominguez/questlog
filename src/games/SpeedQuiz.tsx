import { useEffect, useRef, useState } from "react";
import { Circle, Diamond, Square, Triangle } from "@phosphor-icons/react";
import { play } from "../audio/sfx";
import { isMilestone } from "../engine/Hud";
import { dispatch, multiplier } from "../engine/store";
import { Md } from "../ui/Md";
import type { PlayProps } from "./Game";
import { sample, type QuizItem } from "./pool";
import { points } from "./score";
import { useLater } from "./shell";

const QUESTIONS = 10;
const LIMIT = 20_000;
const REVEAL = 1200;
const SHAPES = [Triangle, Diamond, Circle, Square];

/** Option indexes on the tiles: the answer plus up to 3 others, shuffled; true/false keeps its 2 in order. */
const deal = (q: QuizItem) =>
  q.tf ? [0, 1] : sample([q.answer, ...sample(q.options.map((_, i) => i).filter((i) => i !== q.answer), 3)]);

export function SpeedQuiz({ pool, onEnd }: PlayProps) {
  const [qs] = useState(() => sample(pool.quiz, QUESTIONS).map((q) => ({ ...q, tiles: deal(q) })));
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null | undefined>(undefined); // undefined: open, null: time out
  const [gain, setGain] = useState(0);
  const score = useRef(0);
  const streak = useRef(0);
  const open = useRef(true);
  const t0 = useRef(performance.now());
  const bar = useRef<HTMLDivElement>(null);
  const later = useLater();
  const q = qs[i];

  const answer = (k: number | null) => {
    if (!open.current) return;
    open.current = false;
    const right = k === q.answer;
    streak.current = right ? streak.current + 1 : 0;
    const pts = points(right, performance.now() - t0.current, LIMIT, streak.current);
    score.current += pts;
    dispatch({ type: "answer", id: q.id, ctype: q.ctype, result: right ? "ok" : "wrong", now: Date.now() });
    play(!right ? "bad" : isMilestone(streak.current) ? "streak" : "ok");
    setPicked(k);
    setGain(pts);
    later(() => {
      if (i + 1 >= qs.length) { onEnd(score.current); return; }
      open.current = true;
      t0.current = performance.now();
      setPicked(undefined);
      setI(i + 1);
    }, REVEAL);
  };

  useEffect(() => {
    let id = requestAnimationFrame(function tick() {
      const left = Math.max(0, 1 - (performance.now() - t0.current) / LIMIT);
      bar.current?.style.setProperty("--left", String(left));
      if (!open.current) return;
      if (left <= 0) { answer(null); return; }
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [i]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= q.tiles.length && !e.metaKey && !e.ctrlKey && !e.altKey) answer(q.tiles[n - 1]);
    };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  });

  const mult = multiplier(streak.current);
  return (
    <div className="g-quiz">
      <div className="game-status">
        <span>{i + 1} / {qs.length}</span>
        <b>{score.current}</b>
      </div>
      <div className="game-timer" ref={bar} aria-hidden="true"><div /></div>
      <Md className="game-prompt" text={q.prompt} />
      <div className={`g-tiles${q.tiles.length === 2 ? " two" : ""}`}>
        {q.tiles.map((k, n) => {
          const Shape = SHAPES[n];
          const st = picked === undefined ? "" : k === q.answer ? " right" : k === picked ? " wrong" : " dim";
          return (
            <button key={k} type="button" className={`g-tile t${n + 1}${st}`} disabled={picked !== undefined}
              aria-keyshortcuts={String(n + 1)} onClick={() => answer(k)}>
              <Shape weight="fill" aria-hidden="true" />
              <Md text={q.options[k]} inline />
            </button>
          );
        })}
        {picked !== undefined && (
          <div key={i} className={`g-gain${gain ? "" : " none"}`} role="status">
            {gain ? `+${gain}` : picked === null ? "Time's up" : "+0"}
            {gain > 0 && mult > 1 && <span className="mult">x{mult}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
