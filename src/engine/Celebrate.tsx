import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { play } from "../audio/sfx";
import { RANKS } from "./store";
import { RankBadge } from "./Hud";
import "./engine.css";

const COLORS = ["#ff8a5c", "#ffcb5c", "#56d6a8", "#7aa7ff", "#eeecf7"]; // canvas needs literal colors (mirror of global.css tokens)

export function burst(big = false) {
  try {
    confetti({ particleCount: big ? 160 : 70, spread: big ? 100 : 70, origin: { y: 0.6 }, colors: COLORS, disableForReducedMotion: true });
    if (big) setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: COLORS, disableForReducedMotion: true }), 250);
    if (big) setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: COLORS, disableForReducedMotion: true }), 400);
  } catch { /* canvas unavailable */ }
}

/** Rank-up overlay. */
export function LevelUp({ rank, onClose }: { rank: number; onClose: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    play("levelup");
    burst(true);
    btn.current?.focus();
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, []);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="levelup-title" onClick={onClose}>
      <div className="levelup" onClick={(e) => e.stopPropagation()}>
        <RankBadge index={rank} className="big" />
        <div className="kicker">New rank</div>
        <h2 id="levelup-title">{RANKS[rank].name}</h2>
        <button ref={btn} type="button" className="btn" onClick={onClose}>Continue</button>
      </div>
    </div>
  );
}
