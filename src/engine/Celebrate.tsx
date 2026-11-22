import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { play } from "../audio/sfx";
import { RANKS } from "./store";
import { RankBadge } from "./Hud";
import { token } from "../ui/theme";
import "./engine.css";

// On the main thread: the page CSP allows no blob: workers, and a blocked worker draws nothing.
const confettiOnPage = confetti.create(undefined, { resize: true, useWorker: false });

export function burst(big = false) {
  try {
    const COLORS = ["--accent", "--gold", "--ok", "--info", "--fg"].map(token);
    confettiOnPage({ particleCount: big ? 160 : 70, spread: big ? 100 : 70, origin: { y: 0.6 }, colors: COLORS, disableForReducedMotion: true });
    if (big) setTimeout(() => confettiOnPage({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: COLORS, disableForReducedMotion: true }), 250);
    if (big) setTimeout(() => confettiOnPage({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: COLORS, disableForReducedMotion: true }), 400);
  } catch { /* canvas unavailable */ }
}

/** Rank-up overlay. */
export function LevelUp({ rank, onClose }: { rank: number; onClose: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    play("levelup");
    burst(true);
    btn.current?.focus();
    // The only control is the button: Tab stays on it, and the page under the overlay doesn't scroll.
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "Tab") { e.preventDefault(); btn.current?.focus(); } };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    addEventListener("keydown", on);
    return () => { removeEventListener("keydown", on); document.body.style.overflow = overflow; };
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
