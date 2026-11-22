import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Md } from "../ui/Md";
import "./questie.css";

export type Mood = "idle" | "happy" | "sad" | "think" | "cheer";

// One shared Questie state, so a result anywhere (challenge, level end) shows on whichever Questie is on screen.
let state = { mood: "idle" as Mood, n: 0, tip: null as string | null, open: false };
let timer: ReturnType<typeof setTimeout> | undefined;
const subs = new Set<() => void>();
const emit = (next: Partial<typeof state>) => { state = { ...state, ...next }; subs.forEach((f) => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const useQuestie = () => useSyncExternalStore(subscribe, () => state);

/** Plays a mood once, then Questie settles back to idle. */
export function react(mood: Mood, ms = 2200) {
  clearTimeout(timer);
  emit({ mood, n: state.n + 1 });
  if (mood !== "idle") timer = setTimeout(() => emit({ mood: "idle" }), ms);
}

/** Sets the tip Questie holds; `open` shows the bubble now, otherwise Questie waits to be tapped. */
export function say(tip: string | null | undefined, open = false) {
  emit({ tip: tip ?? null, open: !!tip && open });
}

const EYES = [38, 61];

/** The sticky-note mascot. Face and outline stay dark (they sit on yellow); limbs follow the page ink. */
export function Questie({ mood = "idle", className = "" }: { mood?: Mood; className?: string }) {
  return (
    <span className={`questie ${className}`} data-mood={mood} aria-hidden="true">
      <svg viewBox="0 0 100 112">
        <g className="all">
          <g className="dots fill-limb"><circle cx="70" cy="8" r="3" /><circle cx="80" cy="2" r="3" /><circle cx="91" cy="-4" r="3" /></g>
          <g className="sparks"><path d="M8 12l3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1z" /><path d="M88 22l2 4 4 .6-3 3 .7 4-3.7-2-3.7 2 .7-4-3-3 4-.6z" /></g>
          <path className="leg l limb" d="M38 86v16h-7" /><path className="leg r limb" d="M60 86v16h7" />
          <path className="arm l limb" d="M18 52q-11 2-13 13" /><path className="arm r limb" d="M82 48q11 0 14 11" />
          <g transform="rotate(-3 50 50)">
            <path className="ink note" d="M18 16H82V70L66 86H18Z" /><path className="ink fold" d="M82 70H66V86Z" />
            <g className="eyes">
              {EYES.map((x) => (
                <g key={x} className="eye">
                  <ellipse className="ink white" cx={x} cy="40" rx="7" ry="7.8" strokeWidth="2.5" />
                  <circle className="pupil fill-ink" cx={x + 1} cy="41" r="3.4" />
                </g>
              ))}
            </g>
            <path className="happy-eyes ink" d="M32.4 42q5.6-9 11.2 0M55.4 42q5.6-9 11.2 0" />
            <path className="brows ink" d="M31 29l9.8 3.5M68 29l-9.8 3.5" />
            <path className="tear" d="M66 48.5q3 6 0 9q-3-3 0-9z" />
            <path className="m-idle ink" d="M44 58q6 5 12 0" />
            <path className="m-happy ink fill-ink" d="M41 56q9 15 18 0z" />
            <path className="m-sad ink" d="M43 62q7-7 14 0" />
            <path className="m-think ink" d="M48 59h8" />
          </g>
        </g>
      </svg>
    </span>
  );
}

/** Questie in a screen header: reacts to results and holds the current tip. Tap to open or close it. */
export function Guide() {
  const q = useQuestie();
  useEffect(() => () => say(null), []);
  const face = <Questie key={q.n} mood={q.mood} />;
  return (
    <div className="guide">
      {q.tip ? (
        <button type="button" className="guide-btn" aria-label="Tip" aria-expanded={q.open} onClick={() => emit({ open: !q.open })}>
          {face}{!q.open && <span className="guide-badge" aria-hidden="true">?</span>}
        </button>
      ) : face}
      {q.tip && q.open && (
        <div className="say" role="status">
          <Md text={q.tip} />
          <button type="button" className="say-x" aria-label="Close" onClick={() => emit({ open: false })}>×</button>
        </div>
      )}
    </div>
  );
}

const KEY = (course: string) => `questie:map:${course}`;
const OLD_KEY = (course: string) => `questlog:questie:${course}`;

/** The stop Questie stood at last time on this map (`at` when unknown); records `at` for next time. */
export function lastStop(course: string, at: number): number {
  try {
    const from = Number(localStorage.getItem(KEY(course)) ?? localStorage.getItem(OLD_KEY(course)) ?? at);
    localStorage.setItem(KEY(course), String(at));
    return from;
  } catch { return at; } // storage blocked
}
const W = 52, H = 58; // rendered size of .map-questie
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Questie on the course map: stands beside the current stop and, after a level is cleared,
 * walks the route from the stop it stood at last time. pts: x in % of the path width, y in px (orb centres).
 */
export function MapQuestie({ course, pts, at, row }: { course: string; pts: { x: number; y: number }[]; at: number; row: number }) {
  const el = useRef<HTMLDivElement>(null);
  const [mood, setMood] = useState<Mood>("idle");

  useLayoutEffect(() => {
    const node = el.current, wrap = node?.parentElement;
    if (!node || !wrap || !pts[at]) return;
    const px = (i: number) => (pts[i].x / 100) * wrap.clientWidth;
    // Beside the orb (radius 36), on whichever side has room.
    const rest = (i: number) => `translate(${pts[i].x < 50 ? px(i) + 44 : px(i) - 44 - W}px, ${pts[i].y - 34}px)`;
    const from = lastStop(course, at);
    node.style.transform = rest(at);
    const onResize = () => { if (!node.classList.contains("walking")) node.style.transform = rest(at); };
    addEventListener("resize", onResize);
    if (!(from >= 0 && from < at) || reduced()) return () => removeEventListener("resize", onResize);

    const frames: Keyframe[] = [{ transform: rest(from) }];
    for (let i = from; i < at; i++) {
      const [ax, ay, bx, by] = [px(i), pts[i].y, px(i + 1), pts[i + 1].y];
      for (let k = 0; k <= 16; k++) {
        const t = k / 16, u = 1 - t; // cubic Bézier with the same controls as the route in Map.tsx
        const x = u * u * u * ax + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * bx;
        const y = u * u * u * ay + 3 * u * u * t * (ay + row / 2) + 3 * u * t * t * (by - row / 2) + t * t * t * by;
        frames.push({ transform: `translate(${x - W / 2}px, ${y - H + 4}px)` });
      }
    }
    frames.push({ transform: rest(at) });
    node.classList.add("walking");
    node.classList.toggle("left", px(at) < px(from));
    const anim = node.animate(frames, { duration: 1400 + 1100 * (at - from), easing: "ease-in-out" });
    anim.onfinish = () => { node.classList.remove("walking", "left"); setMood("cheer"); setTimeout(() => setMood("idle"), 1800); };
    node.scrollIntoView?.({ block: "center", behavior: "smooth" });
    return () => { anim.cancel(); removeEventListener("resize", onResize); };
  }, [course, at, pts.length, row]);

  return <div ref={el} className="map-questie"><Questie key={mood} mood={mood} /></div>;
}
