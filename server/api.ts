import { Hono, type MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { GradeRequest, SavedAnswer } from "../shared/api-types";
import { toMarkdown } from "../src/answers/export";
import { claudeGrader, parseGrade, type Grader } from "./grader";

export const MAX_ANSWER = 8000;
const MAX_TEXT = 20000;
const SOURCES = ["typed", "dictated", "mixed"] as const;

const str = (v: unknown, max: number, min = 0): v is string => typeof v === "string" && v.trim().length >= min && v.length <= max;

function parseGradeRequest(v: unknown): GradeRequest | string {
  const b = (v ?? {}) as Record<string, unknown>;
  if (!str(b.challengeId, 200, 1)) return "challengeId inválido";
  if (!str(b.prompt, MAX_TEXT, 1)) return "prompt inválido";
  if (!str(b.model, MAX_TEXT, 1)) return "model inválido";
  if (!Array.isArray(b.keyPoints) || b.keyPoints.length > 50 || !b.keyPoints.every((k) => str(k, 2000, 1))) return "keyPoints inválido";
  if (!str(b.answer, MAX_ANSWER, 1)) return `La respuesta debe tener entre 1 y ${MAX_ANSWER} caracteres`;
  return { challengeId: b.challengeId, prompt: b.prompt, model: b.model, keyPoints: b.keyPoints, answer: b.answer };
}

function parseSave(v: unknown): Omit<SavedAnswer, "id" | "createdAt"> | string {
  const b = (v ?? {}) as Record<string, unknown>;
  if (!str(b.challengeId, 200, 1)) return "challengeId inválido";
  if (!str(b.levelId, 200, 1)) return "levelId inválido";
  if (!str(b.prompt, MAX_TEXT, 1)) return "prompt inválido";
  if (!str(b.answer, MAX_ANSWER, 1)) return `La respuesta debe tener entre 1 y ${MAX_ANSWER} caracteres`;
  if (!SOURCES.includes(b.source as never)) return "source inválido";
  if (b.seconds !== undefined && (typeof b.seconds !== "number" || !(b.seconds >= 0) || b.seconds > 86400)) return "seconds inválido";
  const grade = b.grade === undefined ? undefined : parseGrade(b.grade);
  if (grade === null) return "grade inválido";
  if (b.selfScore !== undefined && !(Number.isInteger(b.selfScore) && (b.selfScore as number) >= 0 && (b.selfScore as number) <= 10)) return "selfScore inválido";
  return {
    challengeId: b.challengeId, levelId: b.levelId, prompt: b.prompt, answer: b.answer,
    source: b.source as SavedAnswer["source"],
    ...(b.seconds !== undefined && { seconds: Math.round(b.seconds as number) }),
    ...(grade && { grade }),
    ...(b.selfScore !== undefined && { selfScore: b.selfScore as number }),
  };
}

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);
const hostname = (h: string) => h.replace(/:\d+$/, "").toLowerCase();

/**
 * Only this app's own pages may call the API: blocks cross-site simple POSTs (text/plain, no preflight)
 * and DNS rebinding (foreign Host header).
 */
const guard: MiddlewareHandler = async (c, next) => {
  const host = c.req.header("host");
  if (host && !LOCAL.has(hostname(host))) return c.json({ error: "Host no permitido" }, 403);
  const site = c.req.header("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return c.json({ error: "Origen no permitido" }, 403);
  const origin = c.req.header("origin");
  if (origin) {
    let ok = false;
    try { ok = !!host && new URL(origin).host === host; } catch { /* malformed */ }
    if (!ok) return c.json({ error: "Origen no permitido" }, 403);
  }
  if (c.req.method === "POST" && !/^application\/json\b/i.test(c.req.header("content-type") ?? "")) {
    return c.json({ error: "Content-Type debe ser application/json" }, 415);
  }
  await next();
};

export function createApi({
  dataDir = process.env.DATA_DIR ?? "data",
  grader = process.env.ANTHROPIC_API_KEY ? claudeGrader() : null,
}: { dataDir?: string; grader?: Grader | null } = {}) {
  const file = join(dataDir, "answers.jsonl");

  async function readAll(): Promise<SavedAnswer[]> {
    const raw = await readFile(file, "utf8").catch((e) => (e.code === "ENOENT" ? "" : Promise.reject(e)));
    return raw.split("\n").flatMap((line) => {
      if (!line.trim()) return [];
      try { return [JSON.parse(line) as SavedAnswer]; } catch { return []; }
    });
  }

  const json = async (c: { req: { json: () => Promise<unknown> } }) => c.req.json().catch(() => undefined);

  return new Hono()
    .use(guard)
    .use(bodyLimit({ maxSize: 128 * 1024, onError: (c) => c.json({ error: "Petición demasiado grande" }, 413) }))
    .get("/health", (c) => c.json({ ok: true, grader: grader !== null }))
    .post("/grade", async (c) => {
      if (!grader) return c.json({ error: "Corrector no configurado (falta ANTHROPIC_API_KEY)" }, 503);
      const req = parseGradeRequest(await json(c));
      if (typeof req === "string") return c.json({ error: req }, 400);
      try {
        return c.json(await grader(req));
      } catch (e) {
        console.error("grade failed:", e);
        return c.json({ error: "El corrector falló" }, 502);
      }
    })
    .post("/answers", async (c) => {
      const body = parseSave(await json(c));
      if (typeof body === "string") return c.json({ error: body }, 400);
      const saved: SavedAnswer = { id: randomUUID(), ...body, createdAt: new Date().toISOString() };
      await mkdir(dataDir, { recursive: true });
      await appendFile(file, JSON.stringify(saved) + "\n");
      return c.json(saved, 201);
    })
    .get("/answers", async (c) => {
      const id = c.req.query("challengeId");
      const all = (await readAll()).filter((a) => !id || a.challengeId === id);
      return c.json(all.reverse());
    })
    .get("/export", async (c) => {
      c.header("Content-Type", "text/markdown; charset=utf-8");
      c.header("Content-Disposition", 'attachment; filename="mis-respuestas.md"');
      return c.body(toMarkdown((await readAll()).reverse()));
    })
    // A route, not notFound(): mounted with app.route, a sub-app's notFound is ignored and the SPA fallback would answer.
    .all("*", (c) => c.json({ error: "No encontrado" }, 404));
}

export const api = createApi();
