import { useEffect, useState } from "react";
import { levelByKey, type Course } from "../course/registry";
import { play } from "../audio/sfx";
import { go, href } from "../ui/route";
import { Hud } from "../engine/Hud";
import { Theory } from "../engine/Theory";
import { ChallengeCard } from "../engine/Challenge";
import { LevelUp, burst } from "../engine/Celebrate";
import { dispatch, getProgress, MAX_LIVES, rankIndex, useProgress } from "../engine/store";
import { isUnlocked } from "../engine/levels";
import "./screens.css";

type Phase = "theory" | "play" | "result" | "fail";
interface Outcome { stars: number; xp: number; rankUp: number | null }

export function Stars({ n, big = false }: { n: number; big?: boolean }) {
  return (
    <span className={big ? "stars big" : "stars"} role="img" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => <span key={i} className={i < n ? "on" : "off"} style={{ animationDelay: `${0.25 + i * 0.18}s` }}>★</span>)}
    </span>
  );
}

export function Lives({ n }: { n: number }) {
  return (
    <span className="lives" role="img" aria-label={`${n} lives`}>
      {Array.from({ length: MAX_LIVES }, (_, i) => <i key={i} className={i < n ? "" : "lost"} />)}
    </span>
  );
}

// Keyed so moving to the next level starts fresh state.
export const LevelScreen = ({ course, id }: { course: Course; id: string }) => <LevelRun key={id} course={course} id={id} />;

function LevelRun({ course, id }: { course: Course; id: string }) {
  const level = levelByKey(id);
  const progress = useProgress();
  const run = progress.run;
  const [phase, setPhase] = useState<Phase>(level?.theory.length ? "theory" : "play");
  const [i, setI] = useState(0);
  const [out, setOut] = useState<Outcome | null>(null);
  const [showRank, setShowRank] = useState(false);

  useEffect(() => {
    dispatch({ type: "start", levelId: id });
    return () => { if (getProgress().run?.levelId === id) dispatch({ type: "quit" }); };
  }, [id]);

  const ordered = course.levels;
  const at = ordered.findIndex((l) => l.id === id);
  const locked = at >= 0 && !isUnlocked(ordered, at, progress);

  if (!level || locked) {
    return (
      <>
        <Hud />
        <section className="screen-in empty">
          <h1>{locked ? "Level locked" : "Level not found"}</h1>
          <a className="btn" href={href.map(course.id)}>Map</a>
        </section>
      </>
    );
  }

  const nextLevel = ordered[at + 1];
  const lives = run?.levelId === id ? run.lives : MAX_LIVES;
  const total = level.challenges.length;

  const restart = (to: Phase) => {
    dispatch({ type: "start", levelId: id });
    setI(0); setOut(null); setPhase(to);
    play("click");
  };

  const complete = () => {
    const before = getProgress();
    const r = before.run;
    const firstClear = !before.levels[id]?.done;
    const after = dispatch({ type: "finish" });
    const startRank = rankIndex(r?.startXp ?? before.xp);
    const rank = rankIndex(after.xp);
    setOut({ stars: r?.lives ?? MAX_LIVES, xp: after.xp - (r?.startXp ?? after.xp), rankUp: rank > startRank ? rank : null });
    setShowRank(rank > startRank);
    setPhase("result");
    if (rank === startRank) { play(firstClear ? "unlock" : "ok"); burst(); }
  };

  const next = () => {
    if (lives <= 0) { dispatch({ type: "quit" }); play("fail"); setPhase("fail"); return; }
    if (i + 1 < total) setI(i + 1);
    else complete();
  };

  const startPlay = () => { play("click"); if (total === 0) complete(); else setPhase("play"); };

  return (
    <>
      <Hud />
      <section className="level">
        <div className="level-head">
          <a className="back" href={href.map(course.id)} aria-label="Map">←</a>
          <h1>{level.title}</h1>
          {phase === "play" && <Lives n={lives} />}
        </div>

        {phase === "theory" && <Theory key={`t-${id}`} cards={level.theory} onDone={startPlay} />}

        {phase === "play" && level.challenges[i] && (
          <div className="screen-in" key={`${level.challenges[i].id}`}>
            <div className="runbar">
              <div className="progress" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={i}>
                <div style={{ width: `${(i / total) * 100}%` }} />
              </div>
              <span className="count-label">{i + 1}/{total}</span>
            </div>
            <ChallengeCard c={level.challenges[i]} levelId={level.id} onNext={next}
              nextLabel={lives <= 0 ? "Continue" : i + 1 >= total ? "See result" : "Next"} />
          </div>
        )}

        {phase === "result" && out && (
          <div className="result screen-in">
            <div className="kicker">{level.boss ? "Final level cleared" : "Level cleared"}</div>
            <Stars n={out.stars} big />
            <div className="gain">+{out.xp} XP</div>
            <div className="row center">
              {out.stars < 3 && <button type="button" className="btn ghost" onClick={() => restart("play")}>Retry</button>}
              <a className={nextLevel ? "btn ghost" : "btn"} href={href.map(course.id)}>Map</a>
              {nextLevel && <button type="button" className="btn" autoFocus onClick={() => go(href.level(course.id, nextLevel.id))}>Next level</button>}
            </div>
          </div>
        )}

        {phase === "fail" && (
          <div className="result fail screen-in">
            <Lives n={0} />
            <h2>Out of lives</h2>
            <div className="row center">
              {level.theory.length > 0 && <button type="button" className="btn ghost" onClick={() => restart("theory")}>Review theory</button>}
              <button type="button" className="btn" autoFocus onClick={() => restart("play")}>Retry</button>
            </div>
          </div>
        )}
      </section>
      {showRank && out?.rankUp != null && <LevelUp rank={out.rankUp} onClose={() => setShowRank(false)} />}
    </>
  );
}
