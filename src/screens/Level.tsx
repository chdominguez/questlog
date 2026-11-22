import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CaretRight, Check, GameController, Star, Sword } from "@phosphor-icons/react";
import { levelByKey, type Course } from "../course/registry";
import type { Level } from "../course/schema";
import { fmt, GAMES, gameKey, levelPool } from "../games/Game";
import { Md } from "../ui/Md";
import { play } from "../audio/sfx";
import { go, href } from "../ui/route";
import { Hud } from "../engine/Hud";
import { Theory } from "../engine/Theory";
import { ChallengeCard } from "../engine/Challenge";
import { LevelUp, burst } from "../engine/Celebrate";
import { dispatch, getProgress, MAX_LIVES, rankIndex, useProgress } from "../engine/store";
import { isUnlocked } from "../engine/levels";
import { Guide, Questie, react, type Mood } from "../questie/Questie";
import { Narration } from "../narration/Narration";
import "./screens.css";

type Phase = "choose" | "theory" | "play" | "result" | "fail";
interface Outcome { stars: number; xp: number; rankUp: number | null }

export function Stars({ n, big = false }: { n: number; big?: boolean }) {
  return (
    <span className={big ? "stars big" : "stars"} role="img" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => <span key={i} className={i < n ? "on" : "off"} style={{ animationDelay: `${0.2 + i * 0.12}s` }}><Star weight="fill" aria-hidden /></span>)}
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
  const [phase, setPhase] = useState<Phase>("choose");
  const [i, setI] = useState(0);
  const [out, setOut] = useState<Outcome | null>(null);
  const [showRank, setShowRank] = useState(false);
  useEffect(() => { scrollTo(0, 0); }, [i, phase]);

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
    react("cheer", 3200);
  };

  const next = () => {
    if (lives <= 0) { dispatch({ type: "quit" }); play("fail"); react("sad", 3200); setPhase("fail"); return; }
    if (i + 1 < total) setI(i + 1);
    else complete();
  };

  const startPlay = () => { play("click"); if (total === 0) complete(); else setPhase("play"); };

  return (
    <>
      <Hud />
      <section className="level">
        <div className="level-head">
          <a className="back" href={href.map(course.id)} aria-label="Map"><ArrowLeft aria-hidden /></a>
          <h1>{level.title}</h1>
          {phase === "play" && <Lives n={lives} />}
          {phase !== "choose" && <Guide />}
        </div>

        {phase === "choose" && <QuestBoard course={course} level={level} onTheory={() => { play("click"); setPhase("theory"); }} onPlay={startPlay} />}

        {phase === "theory" && (
          <>
            <Narration course={course.id} level={id} />
            <Theory key={`t-${id}`} cards={level.theory} onDone={startPlay} onEnd={() => dispatch({ type: "read", levelId: id })} level={id} />
          </>
        )}

        {phase === "play" && level.challenges[i] && (
          <div className="screen-in" key={`${level.challenges[i].id}`}>
            <div className="runbar">
              <div className="progress" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={i}>
                <div style={{ transform: `scaleX(${i / total})` }} />
              </div>
              <span className="count-label">{i + 1}/{total}</span>
            </div>
            <ChallengeCard c={level.challenges[i]} levelId={level.id} onNext={next}
              nextLabel={lives <= 0 ? "Continue" : i + 1 >= total ? "See result" : "Next"} />
          </div>
        )}

        {phase === "result" && out && (
          <div className="result screen-in">
            <h2>{level.boss ? "Final level cleared" : "Level cleared"}</h2>
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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Level start: Questie's nudge, then Theory, Challenge and this level's own Arcade with progress; the suggested next step is highlighted. */
function QuestBoard({ course, level, onTheory, onPlay }: { course: Course; level: Level; onTheory: () => void; onPlay: () => void }) {
  const p = useProgress();
  const games = useMemo(() => { const pool = levelPool(level); return GAMES.filter((g) => g.size(pool) >= g.min); }, [level]);
  const [takeaway] = useState(() => { const tips = level.theory.flatMap((c) => (c.tip ? [c.tip] : [])); return tips[Math.floor(Math.random() * tips.length)]; });
  const hasTheory = level.theory.length > 0;
  const read = p.read.includes(level.id);
  const { stars = 0, done = false } = p.levels[level.id] ?? {};
  const cleared = level.challenges.filter((c) => p.cleared.includes(c.id)).length;
  const plays = games.reduce((n, g) => n + (p.plays[gameKey(level.id, g.id)] ?? 0), 0);
  const next = hasTheory && !read ? "theory" : !done || !games.length ? "play" : "arcade";
  const [tip, mood]: [string, Mood] =
    next === "theory" ? ["Start with the theory.", "think"]
    : !done ? [hasTheory ? "You read it. Now clear it." : "Three lives. Clear it.", "idle"]
    : stars < 3 ? [`${plural(stars, "star")}. Go for 3.`, "happy"]
    : [takeaway ?? "Perfect clear. Beat your arcade best.", "cheer"];
  const row = (step: string) => `quest-row${next === step ? " next" : ""}`;

  return (
    <div className="quest screen-in">
      <div className="quest-tip">
        <Questie key={mood} mood={mood} />
        <div className="quest-say" role="status"><Md text={tip} /></div>
      </div>
      <ul className="quest-rows">
        {hasTheory && (
          <li>
            <button type="button" className={row("theory")} onClick={onTheory} autoFocus={next === "theory"}>
              <BookOpen weight="duotone" className="quest-icon" aria-hidden />
              <b>Theory</b>
              <span className="quest-stats">
                <span>{plural(level.theory.length, "card")}</span>
                {read && <span className="quest-ok"><Check weight="bold" aria-hidden />Read</span>}
              </span>
              <CaretRight className="quest-go" aria-hidden />
            </button>
          </li>
        )}
        <li>
          <button type="button" className={row("play")} onClick={onPlay} autoFocus={next === "play"}>
            <Sword weight="duotone" className="quest-icon" aria-hidden />
            <b>Challenge</b>
            <span className="quest-stats">
              <Stars n={stars} />
              <span>{cleared}/{level.challenges.length} cleared</span>
            </span>
            <CaretRight className="quest-go" aria-hidden />
          </button>
        </li>
        {games.length > 0 && (
          <li className={row("arcade")}>
            <GameController weight="duotone" className="quest-icon" aria-hidden />
            <b>Arcade</b>
            <span className="quest-stats"><span>{plural(plays, "play")}</span></span>
            <ul className="quest-games">
              {games.map((g, k) => {
                const best = p.best[gameKey(level.id, g.id)];
                return (
                  <li key={g.id}>
                    <a className="quest-game" href={href.game(course.id, g.id, level.id)} onClick={() => play("click")} autoFocus={next === "arcade" && k === 0}>
                      <g.Icon weight="duotone" aria-hidden />
                      <span>{g.name}</span>
                      {best !== undefined && <span className="arcade-best">Best {fmt(g, best)}</span>}
                    </a>
                  </li>
                );
              })}
            </ul>
          </li>
        )}
      </ul>
    </div>
  );
}
