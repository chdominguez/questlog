import { useEffect, useState } from "react";
import type { TheoryBlock } from "../course/schema";
import { Md } from "../ui/Md";
import { play } from "../audio/sfx";
import { permutation } from "./shuffle";
import { ladder } from "./drill";

type DrillBlock = Extract<TheoryBlock, { kind: "drill" }>;
type Side = "l" | "r";

/** Incremental match: one new pair per round with the previous two, then all. A miss replays the round. Practice only. */
export function Drill({ b }: { b: DrillBlock }) {
  const [rounds] = useState(() => ladder(b.pairs.length));
  const [r, setR] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [finished, setFinished] = useState(false);
  const round = rounds[r];
  const fresh = attempt === 0 && r < b.pairs.length ? r : -1; // pair introduced this round

  const onRound = (clean: boolean) => {
    if (!clean) { setAttempt((a) => a + 1); return; }
    play("ok");
    if (r + 1 < rounds.length) { setR(r + 1); setAttempt(0); } else setFinished(true);
  };
  const again = () => { play("click"); setR(0); setAttempt(0); setFinished(false); };

  return (
    <div className="drill">
      <div className="drill-head">
        <span className="qtype">Match</span>
        <span className="count-label">{r + 1}/{rounds.length}</span>
      </div>
      {b.prompt && <Md text={b.prompt} />}
      <Round key={`${r}-${attempt}`} pairs={b.pairs} round={round} fresh={fresh} locked={finished} onDone={onRound} />
      {finished && (
        <div className="row end">
          <button type="button" className="btn ghost" onClick={again}>Again</button>
        </div>
      )}
    </div>
  );
}

function Round({ pairs, round, fresh, locked, onDone }: {
  pairs: DrillBlock["pairs"]; round: number[]; fresh: number; locked: boolean; onDone: (clean: boolean) => void;
}) {
  const [lefts] = useState(() => permutation(round.length).map((i) => round[i]));
  const [rights] = useState(() => permutation(round.length).map((i) => round[i]));
  const [matched, setMatched] = useState<number[]>([]);
  const [sel, setSel] = useState<{ side: Side; pair: number } | null>(null);
  const [miss, setMiss] = useState<{ l: number; r: number } | null>(null);
  const [missed, setMissed] = useState(false);
  const complete = matched.length === round.length;

  useEffect(() => {
    if (!complete || locked) return;
    const t = setTimeout(() => onDone(!missed), 450);
    return () => clearTimeout(t);
  }, [complete]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!miss) return;
    const t = setTimeout(() => setMiss(null), 450);
    return () => clearTimeout(t);
  }, [miss]);

  const tap = (side: Side, pair: number) => {
    if (complete || matched.includes(pair)) return;
    if (!sel || sel.side === side) { setSel(sel?.side === side && sel.pair === pair ? null : { side, pair }); play("click"); return; }
    setSel(null);
    if (sel.pair === pair) { play("match"); setMatched([...matched, pair]); return; }
    play("bad");
    setMissed(true);
    setMiss(side === "l" ? { l: pair, r: sel.pair } : { l: sel.pair, r: pair });
  };

  const tile = (side: Side, pair: number) => {
    const done = matched.includes(pair) || locked;
    const bad = miss && miss[side] === pair;
    const cls = ["mi", done && "right", bad && "wrong", sel?.side === side && sel.pair === pair && "sel"].filter(Boolean).join(" ");
    return (
      <button key={pair} type="button" className={cls} disabled={done} aria-pressed={sel?.side === side && sel.pair === pair}
        onClick={() => tap(side, pair)}>
        {side === "l" && pair === fresh && !done && <span className="tag drill-new">New</span>}
        <Md text={side === "l" ? pairs[pair].left : pairs[pair].right} inline />
      </button>
    );
  };

  return (
    <div className="match">
      <div className="mcol">{lefts.map((p) => tile("l", p))}</div>
      <div className="mcol">{rights.map((p) => tile("r", p))}</div>
    </div>
  );
}
