import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Keyboard, Lightning, ListNumbers, SquaresFour, Trophy } from "@phosphor-icons/react";
import type { Course } from "../course/registry";
import { play } from "../audio/sfx";
import { burst } from "../engine/Celebrate";
import { Hud } from "../engine/Hud";
import { dispatch, getProgress } from "../engine/store";
import { NotFound } from "../screens/NotFound";
import { href } from "../ui/route";
import { buildPool, MIN, type Pool } from "./pool";
import { secs } from "./shell";
import { SpeedQuiz } from "./SpeedQuiz";
import { MatchRace } from "./MatchRace";
import { OrderRush } from "./OrderRush";
import { Falling } from "./Falling";
import "../screens/screens.css";
import "./games.css";

export interface PlayProps { pool: Pool; onEnd: (value: number) => void }
interface GameDef { id: string; name: string; Icon: typeof Lightning; size: (p: Pool) => number; min: number; lower?: boolean; Play: ComponentType<PlayProps> }

export const GAMES: GameDef[] = [
  { id: "quiz", name: "Speed Quiz", Icon: Lightning, size: (p) => p.quiz.length, min: MIN.quiz, Play: SpeedQuiz },
  { id: "match", name: "Match Race", Icon: SquaresFour, size: (p) => p.pairs.length, min: MIN.match, lower: true, Play: MatchRace },
  { id: "order", name: "Order Rush", Icon: ListNumbers, size: (p) => p.orders.length, min: MIN.order, lower: true, Play: OrderRush },
  { id: "falling", name: "Falling", Icon: Keyboard, size: (p) => p.typing.length, min: MIN.falling, Play: Falling },
];

export const fmt = (g: GameDef, v: number) => (g.lower ? secs(v) : String(v));

export function GameScreen({ course, game }: { course: Course; game: string }) {
  const g = GAMES.find((x) => x.id === game);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<"count" | "play" | "end">("count");
  const [value, setValue] = useState(0);
  const pool = useMemo(() => buildPool(course.levels, getProgress()), [course, round]);
  if (!g) return <NotFound />;
  const ready = g.size(pool) >= g.min;

  return (
    <>
      <Hud />
      <section className="game">
        <div className="game-head">
          <a className="back" href={href.arcade(course.id)} aria-label="Arcade">←</a>
          <h1>{g.name}</h1>
        </div>
        {!ready && <a className="btn" href={href.arcade(course.id)}>Arcade</a>}
        {ready && phase === "count" && <Countdown onDone={() => setPhase("play")} />}
        {ready && phase === "play" && <g.Play key={round} pool={pool} onEnd={(v) => { setValue(v); setPhase("end"); }} />}
        {ready && phase === "end" && (
          <End key={round} g={g} course={course} value={value} onAgain={() => { setRound(round + 1); setPhase("count"); }} />
        )}
      </section>
    </>
  );
}

function Countdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3);
  useEffect(() => {
    play(n ? "countdown" : "go");
    const t = setTimeout(() => (n ? setN(n - 1) : onDone()), n ? 700 : 450);
    return () => clearTimeout(t);
  }, [n]);
  return <div key={n} className="game-count" role="timer" aria-live="assertive">{n || "Go"}</div>;
}

function End({ g, course, value, onAgain }: { g: GameDef; course: Course; value: number; onAgain: () => void }) {
  const key = `${course.id}:${g.id}`;
  const [prev] = useState(() => getProgress().best[key]);
  const isNew = prev === undefined ? g.lower || value > 0 : g.lower ? value < prev : value > prev;
  const again = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    dispatch({ type: "best", key, value, lower: g.lower });
    play(isNew ? "levelup" : "ok");
    if (isNew) burst(true);
    again.current?.focus();
  }, []);
  return (
    <div className="game-end">
      <div className="game-end-value">{fmt(g, value)}</div>
      {isNew
        ? <div className="game-new"><Trophy weight="duotone" aria-hidden="true" />New best</div>
        : prev !== undefined && <div className="game-best">Best {fmt(g, prev)}</div>}
      <div className="game-actions">
        <button ref={again} type="button" className="btn" onClick={onAgain}>Play again</button>
        <a className="btn ghost" href={href.arcade(course.id)}>Arcade</a>
      </div>
    </div>
  );
}
