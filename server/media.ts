/** GET /media/:course/:file serves uploaded course media from <data dir>/media/<course>/<file>, with Range support for video/audio. */
import { createReadStream, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { Hono, type MiddlewareHandler } from "hono";
import { MEDIA_MIME, mediaExt, safeMediaName } from "../shared/media";

/** MEDIA_DIR, else `media/` next to the database. Shared with the MCP server so uploads land where this reads. */
export const mediaRoot = () => process.env.MEDIA_DIR ?? join(dirname(process.env.DB_PATH ?? "data/questlog.db"), "media");

export const COURSE_DIR = /^[a-z0-9][a-z0-9-]*$/;

/** Streams a file with ETag, 304 and single Range support. 404 when it is missing or not a file. */
export function serveFile(req: Request, path: string, mime: string, cacheControl: string): Response {
  let st;
  try { st = statSync(path); } catch { return new Response("Not found", { status: 404 }); }
  if (!st.isFile()) return new Response("Not found", { status: 404 });
  const etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
  const h: Record<string, string> = {
    "Content-Type": mime, "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes", ETag: etag,
    "Last-Modified": st.mtime.toUTCString(), "Cache-Control": cacheControl,
  };
  if (req.headers.get("If-None-Match") === etag) return new Response(null, { status: 304, headers: h });
  let start = 0, end = st.size - 1, status: 200 | 206 = 200;
  const range = req.headers.get("Range");
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    const bad = new Response(null, { status: 416, headers: { ...h, "Content-Range": `bytes */${st.size}` } });
    if (!m || (!m[1] && !m[2])) return bad;
    if (m[1]) { start = Number(m[1]); if (m[2]) end = Math.min(end, Number(m[2])); } else start = Math.max(0, st.size - Number(m[2]));
    if (start > end) return bad;
    status = 206;
    h["Content-Range"] = `bytes ${start}-${end}/${st.size}`;
  }
  h["Content-Length"] = String(Math.max(0, end - start + 1));
  const body = st.size === 0 ? null : (Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream);
  return new Response(body, { status, headers: h });
}

export const createMedia = (root: () => string = mediaRoot) => new Hono().get("/media/:course/:file", (c) => {
  const { course, file } = c.req.param();
  const mime = MEDIA_MIME[mediaExt(file)];
  if (!COURSE_DIR.test(course) || !safeMediaName(file) || !mime) return c.text("Not found", 404);
  return serveFile(c.req.raw, join(root(), course, file), mime, "public, max-age=3600, must-revalidate");
});

/** App pages run only scripts from this origin (and Pyodide's CDN): an injected inline script or event handler never runs. */
export const CSP = "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; object-src 'none'; base-uri 'self'";
export const cspHeader: MiddlewareHandler = async (c, next) => {
  await next();
  if (c.res.headers.get("content-type")?.startsWith("text/html")) c.res.headers.set("Content-Security-Policy", CSP);
};
