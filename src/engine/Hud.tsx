import { useEffect, useRef, useState } from "react";
import { getArt } from "../art";
import { play } from "../audio/sfx";
import { href, useRoute } from "../ui/route";
import { dueKeys } from "./srs";
import { dispatch, multiplier, RANKS, rankIndex, rankProgress, useProgress } from "./store";
import "./engine.css";

export const isMilestone = (streak: number) => streak === 3 || (streak >= 5 && streak % 5 === 0);

export function RankBadge({ index, className = "" }: { index: number; className?: string }) {
  const art = getArt(`rank-${index}`);
  return art
    ? <span className={`rank-badge ${className}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: art }} />
    : <span className={`rank-badge text ${className}`} aria-hidden="true">{index + 1}</span>;
}

const Flame = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2c1 3.5-2.5 5-2.5 8.5 0 1.3.8 2.4 2 2.8-.3-1.8.8-3.3 2.3-4.3.2 2.2 2.2 3 2.2 5.5a4 4 0 0 1-8 0c0-.6.1-1.2.3-1.7C6.8 14 6 15.5 6 17a6 6 0 0 0 12 0c0-6-6-8.5-6-15Z" /></svg>
);
const Speaker = ({ off }: { off: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 9h4l5-4v14l-5-4H4z" />
    {off ? <path d="m17 9 5 6m0-6-5 6" /> : <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />}
  </svg>
);

export function Hud() {
  const p = useProgress();
  const r = useRoute();
  const ri = rankIndex(p.xp);
  const next = RANKS[ri + 1];
  const [pulse, setPulse] = useState(0);
  const prevStreak = useRef(p.streak);
  useEffect(() => {
    if (p.streak > prevStreak.current && isMilestone(p.streak)) setPulse((n) => n + 1);
    prevStreak.current = p.streak;
  }, [p.streak]);

  const nav = [
    { href: href.home(), label: "Courses", on: r.name === "home" || "course" in r },
    { href: href.review(), label: "Review", on: r.name === "review", count: dueKeys(p.cards, Date.now()).length },
    { href: href.notes(), label: "Notes", on: r.name === "notes" },
    { href: href.answers(), label: "Answers", on: r.name === "answers" },
  ];
  const mult = multiplier(p.streak);

  return (
    <header className="hud">
      <div className="hud-row">
        <a className="brand" href={href.home()}>Questlog</a>
        <div className="hud-rank">
          <RankBadge index={ri} />
          <div className="hud-rank-body">
            <div className="hud-rank-line"><b>{RANKS[ri].name}</b><span className="hud-xp">{p.xp} XP</span></div>
            <div className="bar" role="progressbar" aria-label={next ? `Toward ${next.name}` : "Top rank"}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rankProgress(p.xp) * 100)}>
              <div style={{ width: `${rankProgress(p.xp) * 100}%` }} />
            </div>
          </div>
        </div>
        <div key={pulse} className={`hud-streak${p.streak > 0 ? " on" : ""}${pulse ? " pulse" : ""}`} aria-label={`Streak ${p.streak}`}>
          <Flame /><b>{p.streak}</b>{mult > 1 && <span className="mult">x{mult}</span>}
        </div>
        <div className="hud-sound">
          <button type="button" className="iconbtn" aria-label={p.sound.muted ? "Unmute" : "Mute"} aria-pressed={p.sound.muted}
            onClick={() => { dispatch({ type: "sound", muted: !p.sound.muted }); play("click"); }}>
            <Speaker off={p.sound.muted || p.sound.volume === 0} />
          </button>
          <input type="range" min={0} max={1} step={0.05} value={p.sound.volume} aria-label="Volume" disabled={p.sound.muted}
            onChange={(e) => dispatch({ type: "sound", volume: Number(e.target.value) })}
            onPointerUp={() => play("click")} onKeyUp={() => play("click")} />
        </div>
      </div>
      <nav className="hud-nav">
        {nav.map((n) => (
          <a key={n.href} href={n.href} aria-current={n.on ? "page" : undefined}>
            {n.label}{n.count ? <span className="count">{n.count}</span> : null}
          </a>
        ))}
      </nav>
    </header>
  );
}
