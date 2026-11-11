// Contract: play(name) never throws; unlock() runs on every user gesture (App.tsx).
export type SfxName = "click" | "ok" | "bad" | "streak" | "levelup" | "fail" | "tick" | "unlock" | "submit";

/** zzfx params: [volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide, deltaSlide,
 * pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo, filter] */
type Params = number[];
type Note = [at: number, params: Params];

const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5, G6 = 1568;
const tone = (f: number, len: number, vol = 0.7, shape = 1): Params => [vol, 0, f, 0.005, len * 0.4, len, shape, 1.6];

// UI sounds are quieter than gameplay feedback (mix hierarchy: UI below SFX).
const UI: SfxName[] = ["click", "tick", "submit"];
const SOUNDS: Record<SfxName, Note[]> = {
  click: [[0, [0.5, 0, 1200, 0, 0.004, 0.02, 1, 2]]],
  tick: [[0, [0.35, 0, 1760, 0, 0, 0.025, 0, 1]]],
  submit: [[0, [0.6, 0, 440, 0.005, 0.03, 0.09, 1, 1, 12]]],
  ok: [[0, tone(E5, 0.1)], [0.075, tone(C6, 0.18)]],
  bad: [[0, [0.38, 0, 233, 0.01, 0.06, 0.16, 2, 1, -4, 0, 0, 0, 0, 0.1, 0, 0, 0, 1, 0, 0, 1600]], [0.11, [0.36, 0, 175, 0.01, 0.08, 0.2, 2, 1, -3, 0, 0, 0, 0, 0.1, 0, 0, 0, 1, 0, 0, 1400]]],
  streak: [[0, tone(C6, 0.06, 0.55, 5)], [0.06, tone(E6, 0.06, 0.55, 5)], [0.12, tone(G6, 0.14, 0.55, 5)]],
  levelup: [[0, tone(C5, 0.12)], [0.1, tone(E5, 0.12)], [0.2, tone(G5, 0.12)], [0.3, [0.7, 0, C6, 0.01, 0.3, 0.45, 1, 1.6, 0, 0, 0, 0, 0.08, 0, 0, 0, 0, 1, 0, 0.25]]],
  fail: [[0, tone(G5 / 2, 0.18, 0.6, 0)], [0.17, tone(E5 / 2, 0.18, 0.6, 0)], [0.34, tone(C5 / 2, 0.4, 0.6, 0)]],
  unlock: [[0, tone(G5, 0.08, 0.5, 0)], [0.07, [0.5, 0, C6, 0.005, 0.15, 0.3, 0, 1, 0, 0, 0, 0, 0.05, 0, 0, 0, 0, 1, 0, 0.3]]],
};

type Zzfx = typeof import("zzfx").ZZFX;
let zz: Zzfx | null = null;
let loading: Promise<Zzfx | null> | null = null;
let master: GainNode | null = null;
let muted = false;
let volume = 0.7;
const cache = new Map<SfxName, AudioBuffer[]>();

// zzfx creates its AudioContext on import (and Node has none), so it loads dynamically, right away in the browser.
function ensure(): Promise<Zzfx | null> {
  loading ??= import("zzfx")
    .then((m) => {
      zz = m.ZZFX;
      master = zz.audioContext.createGain();
      master.gain.value = volume;
      master.connect(zz.audioContext.destination);
      return zz;
    })
    .catch(() => null);
  return loading;
}
if (typeof window !== "undefined") void ensure();

function buffers(z: Zzfx, name: SfxName): AudioBuffer[] {
  let b = cache.get(name);
  if (!b) {
    b = SOUNDS[name].map(([, p]) => {
      const samples = z.buildSamples(...p) as Float32Array;
      const buf = z.audioContext.createBuffer(1, Math.max(1, samples.length), z.sampleRate);
      buf.getChannelData(0).set(samples);
      return buf;
    });
    cache.set(name, b);
  }
  return b;
}

function schedule(z: Zzfx, out: GainNode, name: SfxName) {
  const ctx = z.audioContext;
  const t0 = ctx.currentTime + 0.01;
  const pitch = 1 + (Math.random() * 2 - 1) * 0.02; // slight variation so repeats don't sound identical
  const gain = ctx.createGain();
  gain.gain.value = UI.includes(name) ? 0.45 : 0.9;
  gain.connect(out);
  buffers(z, name).forEach((buf, i) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = pitch;
    src.connect(gain);
    src.start(t0 + SOUNDS[name][i][0]);
  });
}

// Synchronous on purpose: Safari only lets resume() start audio when it is called inside the user's event
// handler, with no await before it.
function playNow(name: SfxName) {
  const z = zz, out = master;
  if (!z || !out) { void ensure(); return; } // still loading: drop this one
  if (muted || volume <= 0) return;
  const ctx = z.audioContext;
  if (ctx.state === "running") { schedule(z, out, name); return; }
  // Outside a gesture the resume is refused or late: drop the sound rather than play it out of context.
  const asked = performance.now();
  ctx.resume().then(() => { if (performance.now() - asked < 300) schedule(z, out, name); }, () => {});
}

export function play(name: SfxName): void {
  try { playNow(name); } catch { /* never throw */ }
}

/** Call from every user gesture: cheap once running, and re-arms audio after Safari suspends it. */
export function unlock(): void {
  try {
    if (!zz) { void ensure(); return; }
    const ctx = zz.audioContext;
    if (ctx.state === "running") return;
    ctx.resume().catch(() => {});
    const src = ctx.createBufferSource(); // silent buffer: needed by iOS Safari to really unlock output
    src.buffer = ctx.createBuffer(1, 1, zz.sampleRate);
    src.connect(ctx.destination);
    src.start();
  } catch { /* never throw */ }
}

export function setMuted(m: boolean): void { muted = m; }

export function setVolume(v: number): void {
  volume = Math.min(1, Math.max(0, v));
  try { if (master && zz) master.gain.setTargetAtTime(volume, zz.audioContext.currentTime, 0.02); } catch { /* ignore */ }
}

/** AudioContext state for E2E ("none" before the first unlock). */
export const audioState = (): AudioContextState | "none" => zz?.audioContext.state ?? "none";

if (typeof window !== "undefined") (window as unknown as { __eqAudio: unknown }).__eqAudio = { state: audioState, play };
