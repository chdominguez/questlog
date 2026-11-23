import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CaretDown, CaretRight, Check, GameController, Star, Sword, X } from "@phosphor-icons/react";
import { levelByKey, type Course } from "../course/registry";
import type { Challenge, Level } from "../course/schema";
import { fmt, GAMES, gameKey, levelPool } from "../games/Game";
import { Md } from "../ui/Md";
import { play } from "../audio/sfx";
import { go, href } from "../ui/route";
import { Hud } from "../engine/Hud";
import { Theory } from "../engine/Theory";
import { ChallengeCard, kicker } from "../engine/Challenge";
import { LevelUp, burst } from "../engine/Celebrate";
import { dispatch, getProgress, MAX_LIVES, rankIndex, useProgress, type Result } from "../engine/store";
import { clearPos, loadPos, nextOpen, savePos } from "../engine/position";
import { isUnlocked } from "../engine/levels";
import { Guide, Questie, react, TrackQuestie, type Mood } from "../questie/Questie";
import { Narration } from "../narration/Narration";
import { seedTheoryCard, useTheoryCard } from "../narration/card";
import { plainText } from "../../shared/narration";
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

type Res = (Result | null)[];

const Mark = ({ r }: { r: Result | null }) =>
  r === null ? null : r === "ok" || r === "partial" ? <Check weight="bold" aria-label="Correct" /> : <X weight="bold" aria-label="Wrong" />;
const markClass = (r: Result | null) => (r === null ? "" : r === "ok" || r === "partial" ? "ok" : "bad");

/** Every challenge in the level; answered ones are marked and can't be reopened. */
function ChallengeList({ cs, res, i, onPick }: { cs: Challenge[]; res: Res; i: number; onPick: (k: number) => void }) {
  return (
    <ol className="clist">
      {cs.map((c, k) => (
        <li key={c.id}>
          <button type="button" className={markClass(res[k])} disabled={res[k] !== null} aria-current={k === i ? "step" : undefined} onClick={() => onPick(k)}>
            <span className="clist-n">{k + 1}</span>
            <span className="clist-kind">{kicker(c)}</span>
            <span className="clist-q">{plainText(c.prompt)}</span>
            <Mark r={res[k]} />
          </button>
        </li>
      ))}
    </ol>
  );
}

/** The challenge line: one stop per challenge, Questie standing on the current one. */
function Track({ res, i, onJump }: { res: Res; i: number; onJump: (k: number) => void }) {
  return (
    <div className="track">
      <ol className="stops">
        {res.map((r, k) => (
          <li key={k}>
            <button type="button" className={`${markClass(r)}${k === i ? " on" : ""}`} aria-label={`Challenge ${k + 1}`}
              aria-current={k === i ? "step" : undefined} disabled={r !== null} onClick={() => onJump(k)}><Mark r={r} /></button>
          </li>
        ))}
      </ol>
      <TrackQuestie at={i} n={res.length} />
    </div>
  );
}

// Keyed so moving to the next level starts fresh state.
export const LevelScreen = ({ course, id }: { course: Course; id: string }) => <LevelRun key={id} course={course} id={id} />;

function LevelRun({ course, id }: { course: Course; id: string }) {
  const level = levelByKey(id);
  const progress = useProgress();
  const run = progress.run;
  const total = level?.challenges.length ?? 0;
  const [saved] = useState(() => (level ? loadPos(id, total, level.theory.length) : null));
  const [phase, setPhase] = useState<Phase>(saved?.phase ?? "choose");
  const [i, setI] = useState(saved?.i ?? 0);
  const [res, setRes] = useState<Res>(() => saved?.res ?? Array(total).fill(null));
  const [card] = useTheoryCard(id);
  const [out, setOut] = useState<Outcome | null>(null);
  const [showRank, setShowRank] = useState(false);
  useEffect(() => { scrollTo(0, 0); }, [i, phase]);

  // Layout effect: runs after StrictMode's remount, so Theory never flashes card 1.
  useLayoutEffect(() => { if (saved?.phase === "theory") seedTheoryCard(id, saved.card); }, [id, saved]);

  useEffect(() => {
    dispatch({ type: "start", levelId: id, lives: saved?.lives });
    return () => { if (getProgress().run?.levelId === id) dispatch({ type: "quit" }); };
  }, [id]);

  const lives = run?.levelId === id ? run.lives : saved?.lives ?? MAX_LIVES;
  useEffect(() => {
    if ((phase === "theory" || phase === "play") && lives > 0) savePos(id, { phase, card, i, lives, res });
    else if (phase !== "choose") clearPos(id); // finished, failed, or out of lives (a reload is then a retry)
  }, [id, phase, card, i, lives, res]);

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
  const left = nextOpen(res, i);

  const restart = (to: Phase) => {
    dispatch({ type: "start", levelId: id });
    setI(0); setRes(Array(total).fill(null)); setOut(null); setPhase(to);
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
    if (left < 0) complete();
    else setI(left);
  };

  const startPlay = (k = 0) => { play("click"); if (total === 0) complete(); else { setI(k); setPhase("play"); } };
  const jump = (k: number) => { if (k !== i && res[k] === null) { play("click"); setI(k); } };

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

        {phase === "choose" && <QuestBoard course={course} level={level} res={res} onTheory={() => { play("click"); setPhase("theory"); }} onPlay={startPlay} />}

        {phase === "theory" && (
          <>
            <Narration course={course.id} level={id} />
            <Theory key={`t-${id}`} cards={level.theory} onDone={() => startPlay(Math.max(0, res.indexOf(null)))} onEnd={() => dispatch({ type: "read", levelId: id })} level={id} />
          </>
        )}

        {phase === "play" && level.challenges[i] && (
          <div className="screen-in" key={`${level.challenges[i].id}`}>
            <div className="runbar">
              <Track res={res} i={i} onJump={jump} />
              {/* keyed by i so it closes after a jump */}
              <details key={i} className="jump">
                <summary className="count-label">{i + 1}/{total}<CaretDown weight="bold" aria-hidden /></summary>
                <ChallengeList cs={level.challenges} res={res} i={i} onPick={jump} />
              </details>
            </div>
            <ChallengeCard c={level.challenges[i]} levelId={level.id} onNext={next}
              onResult={(r) => setRes((xs) => xs.map((x, k) => (k === i ? r : x)))}
              nextLabel={lives <= 0 ? "Continue" : left < 0 ? "See result" : "Next"} />
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
function QuestBoard({ course, level, res, onTheory, onPlay }: { course: Course; level: Level; res: Res; onTheory: () => void; onPlay: (k?: number) => void }) {
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
          <button type="button" className={row("play")} onClick={() => onPlay()} autoFocus={next === "play"}>
            <Sword weight="duotone" className="quest-icon" aria-hidden />
            <b>Challenge</b>
            <span className="quest-stats">
              <Stars n={stars} />
              <span>{cleared}/{level.challenges.length} cleared</span>
            </span>
            <CaretRight className="quest-go" aria-hidden />
          </button>
          {level.challenges.length > 1 && <ChallengeList cs={level.challenges} res={res} i={-1} onPick={onPlay} />}
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
