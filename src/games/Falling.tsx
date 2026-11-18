import { useEffect, useRef, useState, type FormEvent } from "react";
import { Heart } from "@phosphor-icons/react";
import { play } from "../audio/sfx";
import { gradeCloze } from "../engine/cloze";
import { dispatch } from "../engine/store";
import { Md } from "../ui/Md";
import type { PlayProps } from "./Game";
import { sample } from "./pool";
import { useLater } from "./shell";

const LIVES = 3;
const FIRST_MS = 12_000; // fall time of the first prompt
const SPEEDUP = 0.9; // each clear makes the next fall this much shorter
const FASTEST_MS = 4000;
const REVEAL = 1600;

export function Falling({ pool, onEnd }: PlayProps) {
  const [deck] = useState(() => sample(pool.typing));
  const [n, setN] = useState(0); // prompts dropped so far; the deck repeats
  const [cleared, setCleared] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [landed, setLanded] = useState(false);
  const [val, setVal] = useState("");
  const [miss, setMiss] = useState(false);
  const drop = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const later = useLater();
  const item = deck[n % deck.length];
  const ms = Math.max(FASTEST_MS, FIRST_MS * SPEEDUP ** cleared);

  const next = () => { setN(n + 1); setVal(""); input.current?.focus(); };

  useEffect(() => {
    if (landed) return;
    const t0 = performance.now();
    let id = requestAnimationFrame(function tick() {
      const y = Math.min(1, (performance.now() - t0) / ms);
      drop.current?.style.setProperty("--y", String(y));
      if (y < 1) { id = requestAnimationFrame(tick); return; }
      dispatch({ type: "answer", id: item.id, ctype: item.ctype, result: "wrong", now: Date.now() });
      play("bad");
      setLanded(true);
      setLives(lives - 1);
      later(() => { if (lives - 1 <= 0) onEnd(cleared); else { setLanded(false); next(); } }, REVEAL);
    });
    return () => cancelAnimationFrame(id);
  }, [n, landed]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (landed || !val.trim()) return;
    if (gradeCloze([{ answers: item.answers, exact: item.exact }], [val]).result === "ok") {
      dispatch({ type: "answer", id: item.id, ctype: item.ctype, result: "ok", now: Date.now() });
      play("ok");
      setCleared(cleared + 1);
      next();
    } else {
      play("bad");
      setMiss(true);
      later(() => setMiss(false), 400);
    }
  };

  return (
    <div className="g-falling">
      <div className="game-status">
        <span className="g-lives-row" role="img" aria-label={`${lives} lives`}>
          {Array.from({ length: LIVES }, (_, k) => <Heart key={k} weight={k < lives ? "fill" : "regular"} className={k < lives ? "on" : ""} />)}
        </span>
        <b>{cleared}</b>
      </div>
      <div className="g-arena">
        <div key={n} ref={drop} className={`g-drop${landed ? " landed" : ""}`}>
          <Md text={item.prompt} />
          {landed && <div className="g-drop-answer">{item.answers[0]}</div>}
        </div>
      </div>
      <form className="g-falling-form" onSubmit={submit}>
        <input ref={input} className={miss ? "miss" : ""} value={val} onChange={(e) => setVal(e.target.value)} autoFocus
          aria-label="Answer" autoComplete="off" autoCapitalize="off" spellCheck={false} disabled={lives <= 0} />
        <button type="submit" className="btn">Enter</button>
      </form>
    </div>
  );
}
