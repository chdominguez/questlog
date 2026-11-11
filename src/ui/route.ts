import { useSyncExternalStore } from "react";

/** Hash routes: #/ · #/c/:course · #/c/:course/level/:id · #/c/:course/kata/:id · #/c/:course/mock · #/review · #/answers · #/notes · #/notes/:id */
export type Route =
  | { name: "home" }
  | { name: "map"; course: string }
  | { name: "level"; course: string; id: string }
  | { name: "kata"; course: string; id: string }
  | { name: "mock"; course: string }
  | { name: "review" }
  | { name: "answers" }
  | { name: "notes"; id?: string };

export function parse(hash: string): Route {
  const [, a, b, c, d] = hash.replace(/^#/, "").split("/").map((x) => (x ? decodeURIComponent(x) : x));
  if (a === "c" && b) {
    if ((c === "level" || c === "kata") && d) return { name: c, course: b, id: d };
    if (c === "mock") return { name: "mock", course: b };
    return { name: "map", course: b };
  }
  if (a === "notes") return b ? { name: "notes", id: b } : { name: "notes" };
  if (a === "review" || a === "answers") return { name: a };
  return { name: "home" };
}

const e = encodeURIComponent;
/** Hash for a route target. Level and kata ids may be qualified ("course:id"); only the local part goes in the URL. */
export const href = {
  home: () => "#/",
  map: (course: string) => `#/c/${e(course)}`,
  level: (course: string, id: string) => `#/c/${e(course)}/level/${e(id.slice(id.indexOf(":") + 1))}`,
  kata: (course: string, id: string) => `#/c/${e(course)}/kata/${e(id.slice(id.indexOf(":") + 1))}`,
  mock: (course: string) => `#/c/${e(course)}/mock`,
  review: () => "#/review",
  answers: () => "#/answers",
  notes: (id?: string) => (id ? `#/notes/${e(id)}` : "#/notes"),
};

export const go = (hash: string) => { location.hash = hash; };

const sub = (cb: () => void) => { addEventListener("hashchange", cb); return () => removeEventListener("hashchange", cb); };
export const useRoute = () => parse(useSyncExternalStore(sub, () => location.hash));
