import { useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { CHALLENGES, type Course } from "../course/registry";
import { courseDue } from "../engine/srs";
import { href } from "../ui/route";
import { play } from "../audio/sfx";
import { Hud } from "../engine/Hud";
import { ChallengeCard, shuffled } from "../engine/Challenge";
import { LevelUp, burst } from "../engine/Celebrate";
import { getProgress, rankIndex, useProgress } from "../engine/store";
import "./screens.css";

export const DAILY_CAP = 25;

/** Due cards, most overdue first, capped, then shuffled so levels interleave. */
const deck = (course: string) => {
  const ids = courseDue(getProgress(), course, Date.now()).filter((id) => CHALLENGES[id]).slice(0, DAILY_CAP);
  return shuffled(ids.length).map((i) => ids[i]);
};

export function ReviewScreen({ course }: { course: Course }) {
  const p = useProgress();
  const cards = p.cards;
  const isDue = (id: string) => (cards[id]?.due ?? Infinity) <= Date.now();
  const [round, setRound] = useState(() => ({ queue: deck(course.id), startXp: getProgress().xp }));
  const [i, setI] = useState(0);
  const [rankUp, setRankUp] = useState<number | null>(null);
  const { queue } = round;
  const finished = i >= queue.length;
  const cleared = queue.filter((id) => !isDue(id)).length;
  const left = courseDue(p, course.id, Date.now()).filter((id) => CHALLENGES[id]).length;

  const next = () => {
    if (i + 1 < queue.length) { setI(i + 1); return; }
    setI(queue.length);
    const r = rankIndex(getProgress().xp);
    if (r > rankIndex(round.startXp)) setRankUp(r);
    else { play(cleared > 0 ? "unlock" : "click"); if (cleared > 0) burst(); }
  };
  const again = () => { setRound({ queue: deck(course.id), startXp: getProgress().xp }); setI(0); play("click"); };
  const c = CHALLENGES[queue[i]];

  return (
    <>
      <Hud />
      <section className="level">
        <div className="level-head">
          <a className="back" href={href.map(course.id)} aria-label={course.title}><ArrowLeft aria-hidden /></a>
          <h1>Review</h1>
        </div>

        {queue.length === 0 && (
          <div className="result screen-in">
            <h2>Nothing due</h2>
            <a className="btn" href={href.map(course.id)}>{course.title}</a>
          </div>
        )}

        {!finished && c && (
          <div className="screen-in" key={`${round.startXp}-${i}`}>
            <div className="runbar">
              <div className="progress" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={queue.length} aria-valuenow={i}>
                <div style={{ width: `${(i / queue.length) * 100}%` }} />
              </div>
              <span className="count-label">{i + 1}/{queue.length}</span>
            </div>
            <ChallengeCard c={c} levelId={c.levelId} onNext={next} nextLabel={i + 1 >= queue.length ? "Finish" : "Next"} />
          </div>
        )}

        {finished && queue.length > 0 && (
          <div className="result screen-in">
            <h2>Round complete</h2>
            <div className="gain">{cleared}/{queue.length}</div>
            <div className="row center">
              <a className={left ? "btn ghost" : "btn"} href={href.map(course.id)}>{course.title}</a>
              {left > 0 && <button type="button" className="btn" autoFocus onClick={again}>Another round</button>}
            </div>
          </div>
        )}
      </section>
      {rankUp != null && <LevelUp rank={rankUp} onClose={() => setRankUp(null)} />}
    </>
  );
}
