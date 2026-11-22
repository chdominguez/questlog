import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Hono, type Context } from "hono";
import type { NarrationState, NarrationTrack } from "../shared/api-types";
import { chunks, narrationText } from "../shared/narration";
import { COSTS } from "../shared/pricing";
import { q, type Course } from "../src/course/registry";
import { str, type App, type Deps } from "./api";
import { metered, refund, spend } from "./credits";
import type { Db } from "./db";
import type { Env } from "./env";
import { err } from "./errors";
import { courseFor } from "./grading";
import { enqueue, JobError, registerJob } from "./jobs";
import { serveFile } from "./media";

type Level = Course["levels"][number];
type Track = { card: number; hash: string; text: string };
type JobInput = { courseId: string; levelId: string; voice: string; spendId: string | null; fresh: boolean };

const HASH = /^[a-f0-9]{64}$/;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** <mediaRoot>/_audio/<hash>.mp3; the "_" fails COURSE_DIR, so /media never serves it. */
const audioPath = (env: Env, hash: string) => join(env.MEDIA_DIR ?? join(dirname(env.DB_PATH), "media"), "_audio", `${hash}.mp3`);

const levelOf = (course: Course, id: string): Level | undefined => course.levels.find((l) => l.id === id || l.id === q(course.id, id));

/** One segment per theory card; the hash is the global cache key, shared by every course and user. */
export const tracksOf = (level: Level, voice: string, model: string): Track[] =>
  level.theory.map((card, i) => {
    const text = narrationText(card);
    return { card: i, text, hash: sha256(`${model}\n${voice}\n${text}`) };
  });

// shortcut: per-process single-flight; with more than one server process two jobs could make the same file (same bytes, last rename wins).
const inflight = new Map<string, Promise<void>>();

/** ElevenLabs TTS for one track, written to a temp file and renamed into place. Long text goes in chunks with context. */
async function makeAudio(db: Db, env: Env, f: typeof fetch, voice: string, t: Track): Promise<void> {
  if (!env.ELEVENLABS_API_KEY) throw new JobError("not_configured", "Narration not configured");
  const parts = chunks(t.text);
  const bufs: Buffer[] = [];
  for (let i = 0; i < parts.length; i++) {
    const res = await f(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text: parts[i], model_id: env.ELEVENLABS_MODEL,
        ...(i > 0 && { previous_text: parts[i - 1].slice(-1000) }),
        ...(i < parts.length - 1 && { next_text: parts[i + 1].slice(0, 1000) }),
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new JobError("ai_failed", `ElevenLabs answered ${res.status}`);
    bufs.push(Buffer.from(await res.arrayBuffer()));
  }
  const data = Buffer.concat(bufs);
  const path = audioPath(env, t.hash);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, path);
  await db.prepare("INSERT OR REPLACE INTO narration_audio (hash, voice, chars, bytes, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(t.hash, voice, t.text.length, data.length, new Date().toISOString()).run();
}

export function ensureAudio(db: Db, env: Env, f: typeof fetch, voice: string, t: Track): Promise<void> {
  if (existsSync(audioPath(env, t.hash))) return Promise.resolve();
  let p = inflight.get(t.hash);
  if (!p) {
    p = makeAudio(db, env, f, voice, t).finally(() => inflight.delete(t.hash));
    inflight.set(t.hash, p);
  }
  return p;
}

// Makes the missing audio of one lesson. On failure the jobs module refunds the spend; the unlock it paid for goes too.
registerJob("narration", async (job, { db, env, deps }) => {
  const a = job.input as JobInput;
  try {
    const course = await courseFor(deps, db, job.user, a.courseId);
    const level = course && levelOf(course, a.levelId);
    if (!level) throw new JobError("not_found", "Lesson not found");
    const ts = tracksOf(level, a.voice, env.ELEVENLABS_MODEL);
    for (const t of ts) await ensureAudio(db, env, deps.fetch, a.voice, t);
    return { tracks: ts.length };
  } catch (e) {
    if (a.fresh) {
      await db.prepare("DELETE FROM narration_unlocks WHERE user_id = ? AND course_id = ? AND level_id = ? AND voice = ? AND spend_id IS ?")
        .bind(job.user, a.courseId, a.levelId, a.voice, a.spendId).run();
    }
    throw e;
  }
});

/** GET /narration/audio/:hash, GET /narration/:course/:level, POST /narration. */
export function narrationRoutes(deps: Deps): Hono<App> {
  /** Course, level, voice and current tracks for a request, or the error response. Records the tracks for the audio route. */
  async function lesson(c: Context<App>, courseId: unknown, levelId: unknown, voice: unknown) {
    if (!c.env.ELEVENLABS_API_KEY) return err(c, 503, "not_configured", { feature: "narration" }, "Narration not configured");
    if (!str(courseId, 100, 1) || !str(levelId, 200, 1)) return err(c, 400, "invalid_request", {}, "Invalid course or level");
    const voices = c.env.ELEVENLABS_VOICES;
    const v = voice === undefined || voice === "" ? voices[0] : voice;
    if (typeof v !== "string" || !voices.includes(v)) return err(c, 400, "invalid_request", {}, "Unknown voice");
    const course = await courseFor(deps, c.env.DB, c.get("user"), courseId);
    const level = course && levelOf(course, levelId);
    if (!course || !level) return err(c, 404, "not_found", {}, "Unknown lesson");
    if (!level.theory.length) return err(c, 400, "invalid_request", {}, "Level has no theory");
    const tracks = tracksOf(level, v, c.env.ELEVENLABS_MODEL);
    const version = sha256(JSON.stringify(level.theory)).slice(0, 16);
    c.env.DB.tx((t) => {
      t.run("DELETE FROM narration_tracks WHERE course_id = ? AND level_id = ? AND voice = ? AND version <> ?", course.id, level.id, v, version);
      for (const x of tracks) {
        t.run("INSERT OR IGNORE INTO narration_tracks (course_id, version, level_id, voice, card, hash) VALUES (?, ?, ?, ?, ?, ?)", course.id, version, level.id, v, x.card, x.hash);
      }
    });
    const unlocked = !!(await c.env.DB.prepare("SELECT 1 FROM narration_unlocks WHERE user_id = ? AND course_id = ? AND level_id = ? AND voice = ?")
      .bind(c.get("user"), course.id, level.id, v).first());
    return { course, level, voice: v, tracks, unlocked };
  }

  const state = (env: Env, l: { voice: string; tracks: Track[]; unlocked: boolean }, jobId?: string): NarrationState => ({
    unlocked: l.unlocked, cost: COSTS.narration, voice: l.voice,
    tracks: l.tracks.map((t): NarrationTrack => ({ card: t.card, hash: t.hash, ready: existsSync(audioPath(env, t.hash)) })),
    ...(jobId && { jobId }),
  });

  return new Hono<App>()
    .get("/narration/audio/:hash", async (c) => { // before /:course/:level, which also matches it
      const hash = c.req.param("hash");
      if (!HASH.test(hash)) return err(c, 404, "not_found");
      const ok = await c.env.DB.prepare(
        `SELECT 1 FROM narration_unlocks u JOIN narration_tracks t ON t.course_id = u.course_id AND t.level_id = u.level_id AND t.voice = u.voice
         WHERE u.user_id = ? AND t.hash = ? LIMIT 1`,
      ).bind(c.get("user"), hash).first();
      if (!ok) return err(c, 403, "forbidden", {}, "Narration not unlocked");
      const res = serveFile(c.req.raw, audioPath(c.env, hash), "audio/mpeg", "private, max-age=31536000, immutable");
      return res.status === 404 ? err(c, 404, "not_found", {}, "Audio not ready") : res;
    })
    .get("/narration/:course/:level", async (c) => {
      const l = await lesson(c, c.req.param("course"), c.req.param("level"), c.req.query("voice"));
      return l instanceof Response ? l : c.json(state(c.env, l));
    })
    .post("/narration", async (c) => {
      const b = ((await c.req.json().catch(() => undefined)) ?? {}) as Record<string, unknown>;
      const l = await lesson(c, b.courseId, b.levelId, b.voice);
      if (l instanceof Response) return l;
      const db = c.env.DB, user = c.get("user");
      let spendId: string | null = null, fresh = false;
      if (!l.unlocked) {
        const key = c.req.header("Idempotency-Key");
        if (metered(c.env) && !key) return err(c, 400, "invalid_request", {}, "Idempotency-Key required");
        const s = spend(db, c.env, { user, action: "narration", key: key ?? randomUUID(), ref: l.level.id });
        if (!s.ok) return err(c, s.code === "insufficient_credits" ? 402 : 409, s.code, { action: "narration", cost: s.cost, balance: s.balance });
        if (s.replay) return err(c, 409, "idempotency_conflict"); // that key already paid for an unlock
        if (metered(c.env)) c.header("x-credits-balance", String(s.balance));
        const { meta } = await db.prepare("INSERT OR IGNORE INTO narration_unlocks (user_id, course_id, level_id, voice, spend_id, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(user, l.course.id, l.level.id, l.voice, s.spendId, deps.now().toISOString()).run();
        if (meta.changes) { spendId = s.spendId; fresh = true; } else if (s.spendId) refund(db, s.spendId, "already unlocked");
        l.unlocked = true;
      }
      const missing = l.tracks.some((t) => !existsSync(audioPath(c.env, t.hash)));
      const input: JobInput = { courseId: l.course.id, levelId: l.level.id, voice: l.voice, spendId, fresh };
      const jobId = missing ? enqueue(db, { user, kind: "narration", title: l.level.title, input, spendId }) : undefined;
      return c.json(state(c.env, l, jobId));
    });
}
