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
import { audioSrc, getNarration, jobStatus, unlockNarration } from "./api";
import { useTheoryCard } from "./card";
import "./narration.css";

type Phase = "hidden" | "locked" | "preparing" | "ready" | "playError" | "failed";

const RATES = [1, 1.25, 1.5, 0.75];
const nextRate = (r: number) => RATES[(RATES.indexOf(r) + 1) % RATES.length];
const allReady = (s: NarrationState) => s.tracks.every((t) => t.ready);
const POLL_MS = 2000;
const CHECK_EVERY = 150; // polls (5 min) between job checks; a failed job removes the unlock, so polling sees it sooner

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
  const [durs, setDurs] = useState<Record<number, number>>({}); // per card, for lesson-wide time
  const [rate, setRate] = useState(1);
  const audio = useRef<HTMLAudioElement>(null);
  const keepPlaying = useRef(false); // play on through card changes
  const seekTo = useRef<number | null>(null); // position in the next card's segment after a scrub across cards
  const jobId = useRef<string | undefined>(undefined);
  const blobs = useRef(new Map<string, Promise<string>>()); // native: one download per segment for the lesson's lifetime

  const settle = (s: NarrationState) => { setSt(s); setPhase(s.unlocked ? "ready" : "locked"); };
  const src = (hash: string) => {
    if (!isNative) return audioSrc(hash);
    let p = blobs.current.get(hash);
    if (!p) {
      p = audioSrc(hash);
      p.catch(() => blobs.current.delete(hash));
      blobs.current.set(hash, p);
    }
    return p;
  };
  useEffect(() => () => {
    for (const p of blobs.current.values()) p.then((u) => URL.revokeObjectURL(u), () => {});
    blobs.current.clear();
  }, [course, level]);

  async function listen() {
    setPhase("preparing");
    try {
      const s = await unlockNarration(course, level, newKey());
      keepPlaying.current = true;
      jobId.current = s.jobId;
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

  // Cards play as soon as their own segment is ready; the rest keep coming in.
  const waiting = phase === "ready" && !!st && !allReady(st);
  useEffect(() => {
    if (!waiting) return;
    let n = 0;
    const t = setInterval(async () => {
      n++;
      const s = await getNarration(course, level).catch(() => null);
      if (s && !s.unlocked) {
        // A failed job refunds and removes the unlock; an edit to the lesson only locks it again.
        const status = jobId.current ? await jobStatus(jobId.current).catch(() => null) : null;
        if (status === "failed") { setRefunded(!!me?.credits); setPhase("failed"); } else settle(s);
      } else if (s) {
        setSt(s);
        if (!allReady(s) && n % CHECK_EVERY === 0) {
          const status = jobId.current ? await jobStatus(jobId.current).catch(() => null) : "failed";
          if (status === "done" || status === "failed") { setRefunded(false); setPhase("failed"); }
        }
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [waiting, course, level]); // eslint-disable-line react-hooks/exhaustive-deps

  const track = phase === "ready" ? st?.tracks[card] : undefined;
  const playable = track?.ready ? track.hash : undefined;
  useEffect(() => {
    const a = audio.current;
    if (!playable || !a) return;
    let live = true;
    src(playable).then((u) => {
      if (!live) return;
      a.src = u;
      a.defaultPlaybackRate = a.playbackRate = rate;
      setPos(0);
      if (seekTo.current !== null) { a.currentTime = seekTo.current; seekTo.current = null; }
      if (keepPlaying.current) a.play().catch(() => live && setPhase("playError"));
    }, () => live && setPhase("playError"));
    return () => {
      live = false;
      a.pause();
    };
  }, [playable]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    const a = audio.current;
    if (!a || !playable) return;
    if (a.paused) { keepPlaying.current = true; a.play().catch(() => setPhase("playError")); } else { keepPlaying.current = false; a.pause(); }
  };
  const go = (n: number) => { if (n >= 0 && n < cards) setCard(n); };

  // Segment lengths from metadata; on native (blob URLs) they fill in as cards play.
  const readyKey = st?.tracks.filter((t) => t.ready).map((t) => t.hash).join() ?? "";
  useEffect(() => {
    if (phase !== "ready" || !st || isNative) return;
    const probes = st.tracks.filter((t) => t.ready).map((t) => {
      const a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = () => setDurs((d) => ({ ...d, [t.card]: a.duration }));
      void audioSrc(t.hash).then((u) => { a.src = u; }, () => {});
      return a;
    });
    return () => probes.forEach((a) => { a.onloadedmetadata = null; a.removeAttribute("src"); });
  }, [phase, readyKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const lens = st?.tracks.map((t) => durs[t.card]) ?? [];
  const whole = lens.length > 0 && lens.every((d) => Number.isFinite(d) && d > 0);
  const offset = whole ? lens.slice(0, card).reduce((a, b) => a + b, 0) : 0;
  const total = whole ? lens.reduce((a, b) => a + b, 0) : dur;
  const scrub = (v: number) => {
    const a = audio.current;
    if (!a) return;
    if (!whole) { a.currentTime = v; return; }
    let c = 0, start = 0;
    while (c < lens.length - 1 && v >= start + lens[c]) start += lens[c++];
    if (c === card) a.currentTime = v - start;
    else { seekTo.current = v - start; go(c); }
  };

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
      {(phase === "preparing" || (phase === "ready" && !playable)) && <button type="button" className="btn ghost" disabled aria-busy="true">Preparing audio</button>}
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
      {phase === "ready" && playable && (
        <div className="narr-bar">
          <button type="button" className="iconbtn" aria-label={playing ? "Pause" : "Play"} onClick={toggle}>
            {playing ? <Pause weight="fill" aria-hidden /> : <Play weight="fill" aria-hidden />}
          </button>
          <input
            type="range" className="narr-pos" min={0} max={total || 0} step="any" value={Math.min(offset + pos, total || 0)}
            aria-label="Position" aria-valuetext={`${time(offset + pos)} of ${time(total)}`}
            onChange={(e) => scrub(Number(e.target.value))}
          />
          <span className="narr-time">{time(offset + pos)} / {time(total)}</span>
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
        onDurationChange={(e) => { const d = e.currentTarget.duration; setDur(d); if (playable && track) setDurs((x) => ({ ...x, [track.card]: d })); }}
        onEnded={() => { if (card + 1 < cards) go(card + 1); else keepPlaying.current = false; }}
      />
    </div>
  );
}
