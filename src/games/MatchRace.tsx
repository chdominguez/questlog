import { useRef, useState } from "react";
import { play } from "../audio/sfx";
import { Md } from "../ui/Md";
import type { PlayProps } from "./Game";
import { ROUND_PAIRS, sample } from "./pool";
import { report, useLater, useRefocus, useStopwatch } from "./shell";

const MISS_MS = 1000;

export function MatchRace({ pool, onEnd }: PlayProps) {
  const [pairs] = useState(() => sample(pool.pairs, ROUND_PAIRS));
  const [tiles] = useState(() => sample(pairs.flatMap((p, pair) => [{ pair, text: p.left }, { pair, text: p.right }])));
  const [sel, setSel] = useState<number | null>(null);
  const [done, setDone] = useState<number[]>([]); // matched pair indexes
  const [bad, setBad] = useState<number[]>([]);
  const missed = useRef(new Set<string>());
  const clock = useStopwatch();
  const later = useLater();
  const grid = useRef<HTMLDivElement>(null);
  useRefocus(grid, [done]);

  const tap = (t: number) => {
    if (sel === null || sel === t) { setSel(sel === t ? null : t); play("click"); return; }
    const a = tiles[sel].pair, b = tiles[t].pair;
    setSel(null);
    if (a === b) {
      play("match");
      const next = [...done, a];
      setDone(next);
      if (next.length === pairs.length) {
        const ms = clock.stop();
        // A challenge with pairs left out of this round wasn't fully practiced: partial at best.
        const count = (xs: typeof pairs, id: string) => xs.filter((x) => x.id === id).length;
        pairs.forEach((p) => { if (count(pool.pairs, p.id) > count(pairs, p.id)) missed.current.add(p.id); });
        report(pairs, missed.current);
        later(() => onEnd(ms), 400);
      }
      return;
    }
    play("bad");
    clock.add(MISS_MS);
    missed.current.add(pairs[a].id).add(pairs[b].id);
    setBad([sel, t]);
    later(() => setBad([]), 400);
  };

  return (
    <div className="g-match">
      <div className="game-status">
        <span>{done.length} / {pairs.length}</span>
        <b ref={clock.el} role="timer" />
      </div>
      <div className="g-match-grid" ref={grid}>
        {tiles.map((x, t) => {
          const gone = done.includes(x.pair);
          return (
            <button key={t} type="button" className={`g-match-tile${gone ? " gone" : ""}${bad.includes(t) ? " miss" : ""}`}
              aria-pressed={sel === t} disabled={gone} onClick={() => tap(t)}>
              <Md text={x.text} inline />
            </button>
          );
        })}
      </div>
    </div>
  );
}
