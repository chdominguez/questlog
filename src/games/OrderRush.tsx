import { useRef, useState } from "react";
import { play } from "../audio/sfx";
import { shuffled } from "../engine/shuffle";
import { Md } from "../ui/Md";
import type { PlayProps } from "./Game";
import { sample } from "./pool";
import { report, useLater, useRefocus, useStopwatch } from "./shell";

const ROUNDS = 5;
const MISS_MS = 2000;

export function OrderRush({ pool, onEnd }: PlayProps) {
  const [items] = useState(() => sample(pool.orders, ROUNDS).map((o) => ({ ...o, shown: shuffled(o.steps.length) })));
  const [i, setI] = useState(0);
  const [n, setN] = useState(0); // steps placed
  const [bad, setBad] = useState<number | null>(null);
  const missed = useRef(new Set<string>());
  const clock = useStopwatch();
  const later = useLater();
  const box = useRef<HTMLDivElement>(null);
  useRefocus(box, [i, n]);
  const o = items[i];

  const tap = (k: number) => {
    if (k !== n) {
      play("bad");
      clock.add(MISS_MS);
      missed.current.add(o.id);
      setBad(k);
      later(() => setBad(null), 400);
      return;
    }
    setN(n + 1);
    if (n + 1 < o.steps.length) { play("click"); return; }
    play("match");
    if (i + 1 < items.length) { later(() => { setI(i + 1); setN(0); }, 500); return; }
    const ms = clock.stop();
    report(items, missed.current);
    later(() => onEnd(ms), 500);
  };

  return (
    <div className="g-order">
      <div className="game-status">
        <span>{i + 1} / {items.length}</span>
        <b ref={clock.el} role="timer" />
      </div>
      <Md className="game-prompt" text={o.prompt} />
      {n > 0 && (
        <ol className="g-order-built">
          {o.steps.slice(0, n).map((s, k) => <li key={k}><Md text={s} inline /></li>)}
        </ol>
      )}
      <div className="g-order-steps" ref={box}>
        {o.shown.filter((k) => k >= n).map((k) => (
          <button key={`${i}-${k}`} type="button" className={`g-order-step${bad === k ? " miss" : ""}`} onClick={() => tap(k)}>
            <Md text={o.steps[k]} inline />
          </button>
        ))}
      </div>
    </div>
  );
}
