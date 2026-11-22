import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "@phosphor-icons/react";
import type { NarrationState } from "../../shared/api-types";
import { ApiError, newKey } from "../api";
import { useSession } from "../auth/session";
import { CostButton } from "../billing/CostButton";
import { courseById, levelByKey } from "../course/registry";
import { typingTarget } from "../engine/Theory";
import { mmss } from "../answers/text";
import { isDemo, isNative } from "../platform";
import { audioSrc, getNarration, unlockNarration } from "./api";
import { useTheoryCard } from "./card";
import "./narration.css";

type Phase = "hidden" | "locked" | "preparing" | "ready" | "playError" | "failed";

const RATES = [1, 1.25, 1.5, 0.75];
const nextRate = (r: number) => RATES[(RATES.indexOf(r) + 1) % RATES.length];
const allReady = (s: NarrationState) => s.tracks.every((t) => t.ready);
const POLL_MS = 2000;
const POLL_MAX = 150; // 5 min

/** Lesson audio above the theory cards: one segment per card, kept in step with the card shown. */
export function Narration({ course, level }: { course: string; level: string }) {
  const { me } = useSession();
  if (isDemo || !me?.features.narration) return null;
  return <Player course={course} level={level} />;
}

function Player({ course, level }: { course: string; level: string }) {
  const { me } = useSession();
  const lvl = levelByKey(level);
  const cards = lvl?.theory.length ?? 0;
  const [card, setCard] = useTheoryCard(level);
  const [st, setSt] = useState<NarrationState | null>(null);
  const [phase, setPhase] = useState<Phase>("hidden");
  const [refunded, setRefunded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const audio = useRef<HTMLAudioElement>(null);
  const keepPlaying = useRef(false); // play on through card changes

  const settle = (s: NarrationState) => { setSt(s); setPhase(!s.unlocked ? "locked" : allReady(s) ? "ready" : "preparing"); };

  async function listen() {
    setPhase("preparing");
    try {
      const s = await unlockNarration(course, level, newKey());
      keepPlaying.current = true;
      settle(s);
    } catch (e) {
      setRefunded(false);
      setPhase(e instanceof ApiError && e.status === 402 ? "locked" : "failed"); // 402 opened the top-up sheet
    }
  }

  useEffect(() => {
    let live = true;
    getNarration(course, level).then((s) => {
      if (!live) return;
      if (s.unlocked && !allReady(s)) listen(); // paid, audio missing: a free job remakes it
      else settle(s);
    }, () => {});
    return () => { live = false; };
  }, [course, level]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== "preparing" || !st) return;
    let n = 0;
    const t = setInterval(async () => {
      n++;
      const s = await getNarration(course, level).catch(() => null);
      if (s && !s.unlocked) { setRefunded(!!me?.credits); setPhase("failed"); } // the job failed: refunded, unlock removed
      else if (s && allReady(s)) settle(s);
      else if (n >= POLL_MAX) { setRefunded(false); setPhase("failed"); }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [phase, st, course, level]); // eslint-disable-line react-hooks/exhaustive-deps

  const track = phase === "ready" ? st?.tracks[card] : undefined;
  useEffect(() => {
    const a = audio.current;
    if (!track || !a) return;
    let url: string | null = null, live = true;
    audioSrc(track.hash).then((u) => {
      url = u;
      if (!live) return;
      a.src = u;
      a.defaultPlaybackRate = a.playbackRate = rate;
      setPos(0);
      if (keepPlaying.current) a.play().catch(() => live && setPhase("playError"));
    }, () => live && setPhase("playError"));
    return () => {
      live = false;
      a.pause();
      if (url && isNative) URL.revokeObjectURL(url);
    };
  }, [track?.hash]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) { keepPlaying.current = true; a.play().catch(() => setPhase("playError")); } else { keepPlaying.current = false; a.pause(); }
  };
  const go = (n: number) => { if (n >= 0 && n < cards) setCard(n); };

  useEffect(() => {
    if (phase !== "ready") return;
    const on = (e: KeyboardEvent) => {
      if (e.key !== " " || typingTarget(e) || (e.target as HTMLElement | null)?.closest?.("button, a, input, [role=tab]")) return;
      e.preventDefault();
      toggle();
    };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  });

  useEffect(() => {
    if (phase !== "ready" || !lvl || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({ title: lvl.title, artist: "Questie", album: courseById(course)?.title });
    const handlers: [MediaSessionAction, () => void][] = [
      ["play", () => audio.current?.paused && toggle()],
      ["pause", () => !audio.current?.paused && toggle()],
      ["nexttrack", () => go(card + 1)],
      ["previoustrack", () => go(card - 1)],
    ];
    for (const [k, f] of handlers) ms.setActionHandler(k, f);
    return () => { ms.metadata = null; for (const [k] of handlers) ms.setActionHandler(k, null); };
  }, [phase, card, lvl, course]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === "hidden" || !lvl) return null;
  const time = (s: number) => mmss(Math.floor(Number.isFinite(s) ? s : 0));

  return (
    <div className="narr">
      {phase === "locked" && <CostButton action="narration" label="Listen" className="btn ghost" onPress={listen} />}
      {phase === "preparing" && <button type="button" className="btn ghost" disabled aria-busy="true">Preparing audio</button>}
      {phase === "failed" && (
        <>
          <p className="wa-error" role="alert">Audio failed{refunded && me?.credits ? ` · ${me.credits.costs.narration} credits refunded` : ""}</p>
          <CostButton action="narration" label="Retry" className="btn ghost" onPress={listen} />
        </>
      )}
      {phase === "playError" && (
        <>
          <p className="wa-error" role="alert">Couldn't play audio</p>
          <button type="button" className="btn ghost" onClick={() => { keepPlaying.current = true; setPhase("ready"); }}>Retry</button>
        </>
      )}
      {phase === "ready" && (
        <div className="narr-bar">
          <button type="button" className="iconbtn" aria-label={playing ? "Pause" : "Play"} onClick={toggle}>
            {playing ? <Pause weight="fill" aria-hidden /> : <Play weight="fill" aria-hidden />}
          </button>
          <input
            type="range" className="narr-pos" min={0} max={dur || 0} step="any" value={Math.min(pos, dur || 0)}
            aria-label="Position" aria-valuetext={`${time(pos)} of ${time(dur)}`}
            onChange={(e) => { if (audio.current) audio.current.currentTime = Number(e.target.value); }}
          />
          <span className="narr-time">{time(pos)} / {time(dur)}</span>
          <button type="button" className="btn ghost narr-rate" aria-label={`Speed ${rate}x`} onClick={() => {
            const r = nextRate(rate);
            setRate(r);
            if (audio.current) audio.current.defaultPlaybackRate = audio.current.playbackRate = r;
          }}>{rate}x</button>
        </div>
      )}
      <audio
        ref={audio}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDur(e.currentTarget.duration)}
        onEnded={() => { if (card + 1 < cards) go(card + 1); else keepPlaying.current = false; }}
      />
    </div>
  );
}
