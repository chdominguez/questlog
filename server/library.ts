import { Hono, type Context } from "hono";
import type { CourseStatus, Flag, FlagReason, ReviewQueue, UserCourseMeta } from "../shared/api-types";
import { str, type App, type Deps } from "./api";
import { requireAdmin } from "./admin";
import { findCourse } from "./courses";
import type { Db } from "./db";
import { err } from "./errors";

interface Row {
  id: string; owner_id: string; title: string; lang: string; summary: string | null; status: CourseStatus; mode: UserCourseMeta["mode"];
  levels: number; sources: number; version: number; review_note: string | null; updated_at: string; published_at: string | null; author: string | null;
}
interface FlagRow { id: string; course_id: string; item_id: string | null; reason: FlagReason; text: string | null; created_at: string }

// Author is the Better Auth user name (table "user", migration 0004).
const META = `SELECT c.id, c.owner_id, c.title, c.lang, c.summary, c.status, c.mode, c.levels, c.sources, c.version, c.review_note,
  c.updated_at, c.published_at, u.name AS author FROM user_courses c LEFT JOIN "user" u ON u.id = c.owner_id`;

const toMeta = (r: Row, user: string): UserCourseMeta => ({
  id: r.id, title: r.title, lang: r.lang, summary: r.summary, status: r.status, mine: r.owner_id === user, author: r.author ?? "",
  mode: r.mode, levels: r.levels, sources: r.sources, version: r.version, reviewNote: r.review_note, updatedAt: r.updated_at, publishedAt: r.published_at,
});

const metaOf = async (db: Db, id: string, user: string) => toMeta((await db.prepare(`${META} WHERE c.id = ?`).bind(id).first<Row>())!, user);
const list = async (db: Db, where: string, user: string) => (await db.prepare(`${META} WHERE ${where}`).all<Row>()).results.map((r) => toMeta(r, user));

const REASONS: FlagReason[] = ["wrong", "unclear", "broken", "other"];

/** Owner transitions; `from: null` means any status. */
const OWNER = {
  share: { from: ["private"], to: "link", set: "" },
  publish: { from: ["private", "link", "rejected"], to: "pending", set: "review_note = NULL," },
  unpublish: { from: null, to: "private", set: "published_at = NULL," },
} satisfies Record<string, { from: CourseStatus[] | null; to: CourseStatus; set: string }>;

const illegal = (c: Context, s: string) => err(c, 409, "invalid_request", {}, `Not allowed while ${s}`);

/** Course sharing and publishing, GET /library, POST /flags, admin review. */
export function libraryRoutes(deps: Deps): Hono<App> {
  const now = () => deps.now().toISOString();

  const owner = (action: keyof typeof OWNER) => async (c: Context<App>) => {
    const { from, to, set } = OWNER[action];
    const id = c.req.param("id")!, user = c.get("user");
    const res = c.env.DB.tx((q) => {
      const row = q.get<{ owner_id: string; status: CourseStatus }>("SELECT owner_id, status FROM user_courses WHERE id = ?", id);
      if (!row || (row.owner_id !== user && row.status === "private")) return err(c, 404, "not_found");
      if (row.owner_id !== user) return err(c, 403, "forbidden");
      if (from && !(from as CourseStatus[]).includes(row.status)) return illegal(c, row.status);
      q.run(`UPDATE user_courses SET ${set} status = ?, updated_at = ? WHERE id = ?`, to, now(), id);
      return null;
    });
    return res ?? c.json(await metaOf(c.env.DB, id, user));
  };

  /** Admin decision on a pending course, for the version the admin reviewed. */
  const review = (to: "public" | "rejected") => async (c: Context<App>) => {
    let note: string | null = null;
    const b = await c.req.json().catch(() => undefined);
    if (!Number.isSafeInteger(b?.version)) return err(c, 400, "invalid_request", {}, "version required");
    if (to === "rejected") {
      if (!str(b?.note, 500, 1)) return err(c, 400, "invalid_request", {}, "note must be 1-500 characters");
      note = b.note.trim();
    }
    const id = c.req.param("id")!;
    return c.env.DB.tx((q) => {
      const row = q.get<{ status: CourseStatus; version: number }>("SELECT status, version FROM user_courses WHERE id = ?", id);
      if (!row) return err(c, 404, "not_found");
      if (row.status !== "pending") return illegal(c, row.status);
      if (row.version !== b.version) return err(c, 409, "invalid_request", {}, "Course changed since review");
      const t = now();
      q.run("UPDATE user_courses SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ?, published_at = ? WHERE id = ?",
        to, note, c.get("user"), t, to === "public" ? t : null, id);
      return c.body(null, 204);
    });
  };

  return new Hono<App>()
    .post("/courses/:id/share", owner("share"))
    .post("/courses/:id/publish", owner("publish"))
    .post("/courses/:id/unpublish", owner("unpublish"))
    .get("/library", async (c) => c.json(await list(c.env.DB, "c.status = 'public' ORDER BY c.published_at DESC", c.get("user"))))
    .post("/flags", async (c) => {
      const b = await c.req.json().catch(() => undefined);
      if (!str(b?.courseId, 200, 1) || (b.itemId !== undefined && !str(b.itemId, 200, 1)) || !REASONS.includes(b.reason)
        || (b.text !== undefined && !str(b.text, 500))) return err(c, 400, "invalid_request");
      if (!(await findCourse(c.env.DB, b.courseId, c.get("user")))) return err(c, 404, "not_found");
      await c.env.DB.prepare("INSERT INTO flags (id, user_id, course_id, item_id, reason, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), c.get("user"), b.courseId, b.itemId ?? null, b.reason, b.text?.trim() || null, now()).run();
      return c.body(null, 201);
    })
    .get("/admin/review", requireAdmin, async (c) => {
      const pending = await list(c.env.DB, "c.status = 'pending' ORDER BY c.updated_at", c.get("user"));
      // One row per course + item: the newest open flag, with the count of open flags on that item.
      const { results } = await c.env.DB.prepare("SELECT * FROM flags WHERE status = 'open' ORDER BY created_at DESC, rowid DESC").all<FlagRow>();
      const byItem = new Map<string, Flag>();
      for (const f of results) {
        const k = `${f.course_id}\n${f.item_id ?? ""}`;
        const seen = byItem.get(k);
        if (seen) { seen.count++; continue; }
        byItem.set(k, { id: f.id, courseId: f.course_id, ...(f.item_id && { itemId: f.item_id }), reason: f.reason,
          ...(f.text && { text: f.text }), count: 1, createdAt: f.created_at });
      }
      return c.json({ pending, flags: [...byItem.values()] } satisfies ReviewQueue);
    })
    .post("/admin/courses/:id/approve", requireAdmin, review("public"))
    .post("/admin/courses/:id/reject", requireAdmin, review("rejected"))
    .post("/admin/flags/:id/resolve", requireAdmin, async (c) => {
      const f = await c.env.DB.prepare("SELECT course_id, item_id FROM flags WHERE id = ?").bind(c.req.param("id")).first<FlagRow>();
      if (!f) return err(c, 404, "not_found");
      // Resolves every open flag on the same item, as the queue shows them as one row.
      await c.env.DB.prepare("UPDATE flags SET status = 'resolved' WHERE course_id = ? AND COALESCE(item_id, '') = ? AND status = 'open'")
        .bind(f.course_id, f.item_id ?? "").run();
      return c.body(null, 204);
    });
}
