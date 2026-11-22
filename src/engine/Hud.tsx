import { useEffect, useRef, useState } from "react";
import { Flame, SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { getArt } from "../art";
import { play } from "../audio/sfx";
import { href, useRoute } from "../ui/route";
import { courseDue } from "./srs";
import { dispatch, multiplier, RANKS, rankIndex, rankProgress, useProgress } from "./store";
import "./engine.css";

export const isMilestone = (streak: number) => streak === 3 || (streak >= 5 && streak % 5 === 0);

export function RankBadge({ index, className = "" }: { index: number; className?: string }) {
  const art = getArt(`rank-${index}`);
  return art
    ? <span className={`rank-badge ${className}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: art }} />
    : <span className={`rank-badge text ${className}`} aria-hidden="true">{index + 1}</span>;
}

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
    { href: href.profile(), label: "Profile", on: r.name === "profile" },
  ];
  const tabs = "course" in r && r.name !== "level" && r.name !== "kata" ? [
    { href: href.map(r.course), label: "Map", on: r.name === "map" || r.name === "mock" },
    { href: href.arcade(r.course), label: "Arcade", on: r.name === "arcade" || r.name === "game" },
    { href: href.review(r.course), label: "Review", on: r.name === "review", count: courseDue(p, r.course, Date.now()).length },
    { href: href.notes(r.course), label: "Notes", on: r.name === "notes" },
    { href: href.materials(r.course), label: "Materials", on: r.name === "materials" },
    { href: href.answers(r.course), label: "Answers", on: r.name === "answers" },
  ] : [];
  const mult = multiplier(p.streak);

  return (
    <header className="hud">
      <div className="hud-row">
        <a className="brand" href={href.home()}>Questlog</a>
        <nav className="hud-nav">
          {nav.map((n) => (
            <a key={n.href} href={n.href} aria-current={n.on ? "page" : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="hud-rank">
          <RankBadge index={ri} />
          <div className="hud-rank-body">
            <div className="hud-rank-line"><b>{RANKS[ri].name}</b><span className="hud-xp">{p.xp} XP</span></div>
            <div className="bar" role="progressbar" aria-label={next ? `Toward ${next.name}` : "Top rank"}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rankProgress(p.xp) * 100)}>
              <div style={{ transform: `scaleX(${rankProgress(p.xp)})` }} />
            </div>
          </div>
        </div>
        <div key={pulse} className={`hud-streak${p.streak > 0 ? " on" : ""}${pulse ? " pulse" : ""}`} aria-label={`Streak ${p.streak}`}>
          <Flame weight={p.streak > 0 ? "fill" : "regular"} aria-hidden /><b>{p.streak}</b>{mult > 1 && <span className="mult">x{mult}</span>}
        </div>
        <div className="hud-sound">
          <button type="button" className="iconbtn" aria-label={p.sound.muted ? "Unmute" : "Mute"} aria-pressed={p.sound.muted}
            onClick={() => { dispatch({ type: "sound", muted: !p.sound.muted }); play("click"); }}>
            {p.sound.muted || p.sound.volume === 0 ? <SpeakerSlash aria-hidden /> : <SpeakerHigh aria-hidden />}
          </button>
          <input type="range" min={0} max={1} step={0.05} value={p.sound.volume} aria-label="Volume" disabled={p.sound.muted}
            onChange={(e) => dispatch({ type: "sound", volume: Number(e.target.value) })}
            onPointerUp={() => play("click")} onKeyUp={() => play("click")} />
        </div>
      </div>
      {tabs.length > 0 && (
        <nav className="hud-nav hud-tabs" aria-label="Course">
          {tabs.map((n) => (
            <a key={n.href} href={n.href} aria-current={n.on ? "page" : undefined}>
              {n.label}{"count" in n && n.count ? <span className="count">{n.count}</span> : null}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
