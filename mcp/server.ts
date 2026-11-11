// Questlog MCP server over stdio: `npm run mcp`. See mcp/README.md.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod";
import { CourseSchema } from "../src/course/schema";
import { validateCourse } from "../src/course/validate";
import { defaultRoots, findCourses, listCourses, loadCourse, saveCourse } from "./courses";

const text = (t: string, isError = false) => ({ content: [{ type: "text" as const, text: t }], isError });
const course = z.record(z.string(), z.unknown()).describe("The whole course object, shaped like the questlog://schema/course resource");
const guide = resolve(import.meta.dirname, "../plugins/questlog/skills/questlog-course/SKILL.md");

async function api(path: string) {
  const base = process.env.QUESTLOG_URL;
  if (!base) return text("Notes live in the deployed Questlog app. Set QUESTLOG_URL (the app's base URL) and, if it is behind Cloudflare Access, CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET (a service token) in this MCP server's env, then restart it.", true);
  const headers: Record<string, string> = {};
  if (process.env.CF_ACCESS_CLIENT_ID) headers["CF-Access-Client-Id"] = process.env.CF_ACCESS_CLIENT_ID;
  if (process.env.CF_ACCESS_CLIENT_SECRET) headers["CF-Access-Client-Secret"] = process.env.CF_ACCESS_CLIENT_SECRET;
  try {
    // Access answers a bad token with a redirect to its login page, so don't follow it.
    const res = await fetch(new URL(path, base), { headers, redirect: "manual" });
    if (!res.ok) return text(`GET ${path} failed with ${res.status}.${res.status < 400 || res.status === 401 || res.status === 403 ? " Check CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET." : ""}`, true);
    return { ok: true as const, data: await res.json() };
  } catch (e) {
    return text(`GET ${new URL(path, base)} failed: ${e instanceof Error ? e.message : e}. Check QUESTLOG_URL.`, true);
  }
}

serveStdio(() => {
  const server = new McpServer({ name: "questlog", version: "0.1.0" });

  server.registerTool("course_list", {
    description: "Lists the Questlog courses on this machine: id, title, lang, level and kata counts, file path, and whether it is public (courses/) or private. Start here to find a course_id.",
  }, async () => text(JSON.stringify(await listCourses(defaultRoots()))));

  server.registerTool("course_get", {
    description: "Returns one course as JSON, the same shape course_save accepts. TypeScript courses are evaluated, so helpers like hl() and at() come back as plain line numbers.",
    inputSchema: z.object({ course_id: z.string().describe("Course id from course_list") }),
  }, async ({ course_id }) => {
    const f = findCourses(defaultRoots()).find((c) => c.id === course_id);
    if (!f) return text(`No course "${course_id}". Call course_list for the ids.`, true);
    try {
      return text(JSON.stringify(await loadCourse(f.file)));
    } catch (e) {
      return text(`${f.file} failed to load: ${e instanceof Error ? e.message : e}`, true);
    }
  });

  server.registerTool("course_validate", {
    description: "Checks a course without saving it: the schema, cross-references (art keys, kata ids, answer indexes, trace lines) and every kata (solution passes all tests, starter compiles and fails one). Returns \"valid\" or one problem per line with its path, e.g. levels[2].challenges[0].answer.",
    inputSchema: z.object({ course }),
  }, ({ course }) => {
    const problems = validateCourse(course);
    return problems.length ? text(problems.join("\n"), true) : text("valid");
  });

  server.registerTool("course_save", {
    description: "Validates a course and writes it to <root>/<id>/course.json, where root is courses/ for public or the private courses folder for private. If it is invalid nothing is written and you get the problem list: fix it and call again. It never replaces a TypeScript course (edit that file instead) and replaces an existing course.json only with overwrite: true. Returns the path written.",
    inputSchema: z.object({
      course,
      visibility: z.enum(["public", "private"]).describe("public: committed with the app in courses/. private: the user's own courses folder ($QUESTLOG_COURSES or courses-private/)"),
      overwrite: z.boolean().optional().describe("Replace an existing course.json with the same id"),
    }),
  }, ({ course, visibility, overwrite }) => {
    const r = saveCourse(course, visibility, overwrite ?? false, defaultRoots());
    return "error" in r ? text(r.error, true) : text(`Saved ${r.path}`);
  });

  server.registerTool("note_search", {
    description: "Searches the user's notes in the deployed Questlog app. Both filters are optional; with neither it lists every note. Returns id, title, tags, courseId and updatedAt; read one in full with note_get.",
    inputSchema: z.object({
      query: z.string().optional().describe("Words to look for in titles and bodies"),
      tag: z.string().optional().describe("Only notes with this exact tag"),
    }),
  }, async ({ query, tag }) => {
    const r = await api(`/api/notes?${new URLSearchParams({ ...(query && { q: query }), ...(tag && { tag }) })}`);
    if (!("ok" in r)) return r;
    const notes = r.data as { id: string; title: string; tags: string[]; courseId?: string; updatedAt: string }[];
    return text(JSON.stringify(notes.map(({ id, title, tags, courseId, updatedAt }) => ({ id, title, tags, courseId, updatedAt }))));
  });

  server.registerTool("note_get", {
    description: "Returns one note in full (Markdown body included) by its id from note_search.",
    inputSchema: z.object({ note_id: z.string().describe("Note id from note_search") }),
  }, async ({ note_id }) => {
    const r = await api(`/api/notes/${encodeURIComponent(note_id)}`);
    return "ok" in r ? text(JSON.stringify(r.data)) : r;
  });

  server.registerResource("course-schema", "questlog://schema/course", {
    description: "JSON Schema of a course, the shape course_save accepts. Cross-reference rules (art keys, kata ids, answer indexes) are checked by course_validate, not by the schema.",
    mimeType: "application/schema+json",
  }, (uri) => ({ contents: [{ uri: uri.href, text: JSON.stringify(z.toJSONSchema(CourseSchema, { io: "input" })) }] }));

  server.registerResource("authoring-guide", "questlog://guide/authoring", {
    description: "How to write a good Questlog course: structure, challenge types, katas and art.",
    mimeType: "text/markdown",
  }, (uri) => {
    let t: string;
    try { t = readFileSync(guide, "utf8"); } catch { t = "The questlog-course authoring guide is not installed (plugins/questlog/skills/questlog-course/SKILL.md). Use questlog://schema/course and course_validate."; }
    return { contents: [{ uri: uri.href, text: t }] };
  });

  return server;
});
