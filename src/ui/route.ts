import { useSyncExternalStore } from "react";

/**
 * Hash routes: #/ · #/c/:course · #/c/:course/level/:id · #/c/:course/kata/:id · #/c/:course/mock · #/c/:course/arcade · #/c/:course/arcade/:game
 * · #/c/:course/review · #/c/:course/answers · #/c/:course/materials · #/c/:course/notes · #/c/:course/notes/:id · #/profile · #/profile/credits
 * · #/signin?next= · #/signup · #/verify · #/forgot · #/reset?token= · #/welcome · #/plans?canceled=1 · #/billing/done · #/build · #/build/:job
 * · #/library · #/admin/review. A "?query" inside the hash is not part of the path; hashQuery() reads it.
 */
export type Route =
  | { name: "home" }
  | { name: "map"; course: string }
  | { name: "level"; course: string; id: string }
  | { name: "kata"; course: string; id: string }
  | { name: "mock"; course: string }
  | { name: "arcade"; course: string }
  | { name: "game"; course: string; game: string }
  | { name: "review"; course: string }
  | { name: "answers"; course: string }
  | { name: "materials"; course: string }
  | { name: "notes"; course: string; id?: string }
  | { name: "profile" }
  | { name: "credits" }
  | { name: "signin"; next?: string }
  | { name: "signup" }
  | { name: "verify" }
  | { name: "forgot" }
  | { name: "reset"; token?: string }
  | { name: "welcome" }
  | { name: "plans"; canceled: boolean }
  | { name: "billingDone" }
  | { name: "build" }
  | { name: "job"; id: string }
  | { name: "library" }
  | { name: "adminReview" };

/** Routes anyone can open; every other route needs a session. */
export const PUBLIC_ROUTES = ["signin", "signup", "verify", "forgot", "reset"] as const satisfies Route["name"][];

/** The "?query" part of a hash, e.g. next= on #/signin?next=... */
export const hashQuery = (hash: string) => { const i = hash.indexOf("?"); return new URLSearchParams(i < 0 ? "" : hash.slice(i + 1)); };

export function parse(hash: string): Route {
  const i = hash.indexOf("?");
  const qs = hashQuery(hash);
  const [, a, b, c, d] = (i < 0 ? hash : hash.slice(0, i)).replace(/^#/, "").split("/").map((x) => (x ? decodeURIComponent(x) : x));
  if (a === "c" && b) {
    if ((c === "level" || c === "kata") && d) return { name: c, course: b, id: d };
    if (c === "mock" || c === "review" || c === "answers" || c === "materials") return { name: c, course: b };
    if (c === "arcade") return d ? { name: "game", course: b, game: d } : { name: "arcade", course: b };
    if (c === "notes") return d ? { name: "notes", course: b, id: d } : { name: "notes", course: b };
    return { name: "map", course: b };
  }
  if (a === "profile") return b === "credits" ? { name: "credits" } : { name: "profile" };
  if (a === "signin") return qs.get("next") ? { name: "signin", next: qs.get("next")! } : { name: "signin" };
  if (a === "reset") return qs.get("token") ? { name: "reset", token: qs.get("token")! } : { name: "reset" };
  if (a === "signup" || a === "verify" || a === "forgot" || a === "welcome" || a === "library") return { name: a };
  if (a === "plans") return { name: "plans", canceled: qs.get("canceled") === "1" };
  if (a === "billing" && b === "done") return { name: "billingDone" };
  if (a === "build") return b ? { name: "job", id: b } : { name: "build" };
  if (a === "admin" && b === "review") return { name: "adminReview" };
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
  arcade: (course: string) => `#/c/${e(course)}/arcade`,
  game: (course: string, game: string) => `#/c/${e(course)}/arcade/${e(game)}`,
  review: (course: string) => `#/c/${e(course)}/review`,
  answers: (course: string) => `#/c/${e(course)}/answers`,
  materials: (course: string) => `#/c/${e(course)}/materials`,
  profile: () => "#/profile",
  credits: () => "#/profile/credits",
  signin: (next?: string) => `#/signin${next ? `?next=${e(next)}` : ""}`,
  signup: () => "#/signup",
  verify: () => "#/verify",
  forgot: () => "#/forgot",
  reset: () => "#/reset",
  welcome: () => "#/welcome",
  plans: () => "#/plans",
  billingDone: () => "#/billing/done",
  build: () => "#/build",
  job: (id: string) => `#/build/${e(id)}`,
  library: () => "#/library",
  adminReview: () => "#/admin/review",
  notes: (course: string, id?: string) => `#/c/${e(course)}/notes${id ? `/${e(id)}` : ""}`,
};

export const go = (hash: string) => { location.hash = hash; };

const sub = (cb: () => void) => { addEventListener("hashchange", cb); return () => removeEventListener("hashchange", cb); };
export const useHash = () => useSyncExternalStore(sub, () => location.hash);
export const useRoute = () => parse(useHash());
