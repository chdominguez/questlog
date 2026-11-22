import { expect, test } from "vitest";
import { filterLibrary, isUserCourse, SHARE_ACTIONS, type LibraryItem } from "./api";

const item = (id: string, over: Partial<LibraryItem> = {}): LibraryItem =>
  ({ id, title: id, summary: "", levels: 1, author: "Questie", cited: false, community: false, ...over });

test("library search matches every word in title, summary or author; filter splits bundled and community", () => {
  const items = [
    item("HTTP basics", { summary: "Requests and status codes" }),
    item("Rust ownership", { author: "Ann L.", community: true, cited: true }),
  ];
  const ids = (q: string, f: Parameters<typeof filterLibrary>[2] = "all") => filterLibrary(items, q, f).map((i) => i.id);
  expect(ids("")).toEqual(["HTTP basics", "Rust ownership"]);
  expect(ids("  status   http ")).toEqual(["HTTP basics"]);
  expect(ids("ann")).toEqual(["Rust ownership"]);
  expect(ids("", "questie")).toEqual(["HTTP basics"]);
  expect(ids("", "community")).toEqual(["Rust ownership"]);
  expect(ids("http", "community")).toEqual([]);
});

test("user course ids and share actions per status", () => {
  expect(isUserCourse("u0123456789-rust")).toBe(true);
  expect(isUserCourse("http-basics")).toBe(false);
  expect(SHARE_ACTIONS.public).toEqual([]);
  expect(SHARE_ACTIONS.rejected).toEqual(["submitAgain", "makePrivate"]);
  expect(SHARE_ACTIONS.pending).not.toContain("submit");
});
