import { beforeEach, expect, test, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } });

const server = vi.hoisted(() => ({ metas: [] as { id: string; version: number; mine: boolean }[], courses: {} as Record<string, unknown>, fail: 0 as number, gets: [] as string[] }));
vi.mock("../api", async (orig) => {
  const { ApiError } = await orig<typeof import("../api")>();
  return {
    ApiError,
    call: async (path: string) => {
      if (server.fail) throw new ApiError(server.fail, "x");
      if (path === "/courses") return server.metas;
      server.gets.push(path);
      return server.courses[path.slice("/courses/".length)];
    },
    apiFetch: async (path: string) => {
      const c = server.courses[decodeURIComponent(path.slice("/courses/".length))];
      return c ? new Response(JSON.stringify(c), { headers: { ETag: '"v3"' } }) : new Response("{}", { status: 404 });
    },
  };
});

const { loadCourses, fetchCourse } = await import("./api");
const { courseById, coursesLoaded } = await import("../course/registry");

const course = (id: string, title = "T") => ({
  id, title, lang: "en", levels: [{ id: "l", order: 1, title: "L", theory: [], challenges: [{ id: "q", type: "quiz", prompt: "P", options: ["a", "b"], answer: 0 }] }],
});

beforeEach(() => { server.fail = 0; server.gets = []; });

test("cached courses register before the first await; new versions are fetched; dropped ones go", async () => {
  store.set("ql.courses", JSON.stringify([{ id: "ua-old", version: 1, json: course("ua-old") }, { id: "ua-keep", version: 2, json: course("ua-keep", "Cached") }]));
  server.metas = [{ id: "ua-keep", version: 2, mine: true }, { id: "ua-new", version: 1, mine: true }];
  server.courses = { "ua-new": course("ua-new") };
  const p = loadCourses();
  expect(courseById("ua-old")).toBeTruthy(); // sync, before any await
  expect(coursesLoaded()).toBe(false);
  await p;
  expect(coursesLoaded()).toBe(true);
  expect(courseById("ua-old")).toBeUndefined();
  expect(courseById("ua-keep")?.title).toBe("Cached"); // same version: not fetched again
  expect(courseById("ua-new")).toBeTruthy();
  expect(server.gets).toEqual(["/courses/ua-new"]);
  expect(JSON.parse(store.get("ql.courses")!).map((c: { id: string }) => c.id)).toEqual(["ua-keep", "ua-new"]);
});

test("a link course is fetched once and cached; a missing one is false", async () => {
  server.courses = { "ub-link": course("ub-link") };
  expect(await fetchCourse("ub-link")).toBe(true);
  expect(courseById("ub-link")).toBeTruthy();
  expect(JSON.parse(store.get("ql.courses")!).find((c: { id: string }) => c.id === "ub-link").version).toBe(3);
  expect(await fetchCourse("nope")).toBe(false);
});

test("signed out: cached courses are dropped", async () => {
  server.fail = 401;
  await loadCourses();
  expect(courseById("ua-keep")).toBeUndefined();
  expect(store.get("ql.courses")).toBe("[]");
});
