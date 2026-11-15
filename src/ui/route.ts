import { useSyncExternalStore } from "react";

/** Hash routes: #/ · #/c/:course · #/c/:course/level/:id · #/c/:course/kata/:id · #/c/:course/mock · #/c/:course/review · #/c/:course/answers · #/c/:course/notes · #/c/:course/notes/:id · #/profile */
export type Route =
  | { name: "home" }
  | { name: "map"; course: string }
  | { name: "level"; course: string; id: string }
  | { name: "kata"; course: string; id: string }
  | { name: "mock"; course: string }
  | { name: "review"; course: string }
  | { name: "answers"; course: string }
  | { name: "notes"; course: string; id?: string }
  | { name: "profile" };

export function parse(hash: string): Route {
  const [, a, b, c, d] = hash.replace(/^#/, "").split("/").map((x) => (x ? decodeURIComponent(x) : x));
  if (a === "c" && b) {
    if ((c === "level" || c === "kata") && d) return { name: c, course: b, id: d };
    if (c === "mock" || c === "review" || c === "answers") return { name: c, course: b };
    if (c === "notes") return d ? { name: "notes", course: b, id: d } : { name: "notes", course: b };
    return { name: "map", course: b };
  }
  if (a === "profile") return { name: "profile" };
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
  review: (course: string) => `#/c/${e(course)}/review`,
  answers: (course: string) => `#/c/${e(course)}/answers`,
  profile: () => "#/profile",
  notes: (course: string, id?: string) => `#/c/${e(course)}/notes${id ? `/${e(id)}` : ""}`,
};

export const go = (hash: string) => { location.hash = hash; };

const sub = (cb: () => void) => { addEventListener("hashchange", cb); return () => removeEventListener("hashchange", cb); };
export const useRoute = () => parse(useSyncExternalStore(sub, () => location.hash));
