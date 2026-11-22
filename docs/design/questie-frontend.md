# Questie: frontend design

Client-side design for `questie-plan.md` and `questie-prd.md`. Plan decisions are final. Line numbers refer to branch `questie` at `d172e33`.

The server contract below is what the client needs. Route names and shapes are proposals; where the backend design names them differently, the backend wins and only `src/api.ts` changes.

## 1. Principles

- Keep the structure: hash routes in `src/ui/route.ts`, `useSyncExternalStore` stores like `src/engine/store.ts`, one fetch helper in `src/answers/api.ts`, screens in `src/screens/`.
- One identity source: `GET /api/me`. Better Auth's client is used only for sign-in, sign-up, sign-out and token handling, not as a second session store.
- Native code only behind `isNative`. Native plugins are dynamically imported so the web bundle does not grow.
- Offline keeps working: progress stays in localStorage, the last `/me` and the last course list are cached, and a failed network call never signs the user out.
- UI copy follows the repo rule: short, imperative, no description under titles. Strings proposed here are final candidates, not placeholders.

## 2. Platform and API base

New `src/platform.ts`:

```ts
import { Capacitor } from "@capacitor/core";
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform() as "web" | "ios" | "android";
/** "" on web (same origin); the hosted server on iOS/Android. */
export const API_BASE = isNative ? import.meta.env.VITE_API_BASE : "";
```

Everything that builds a server URL uses `API_BASE`:

| Today | Change |
|---|---|
| `src/answers/api.ts:8` `fetch(\`/api${path}\`)` | `apiFetch(path)` (section 4) |
| `src/answers/api.ts:34,43,44,47` raw `fetch("/api/...")` | same `apiFetch` |
| `src/engine/sync.ts:21,36,39` raw fetch | same `apiFetch`, `/me` moves to the session store (section 3.3) |
| `shared/media.ts` `mediaUrl`, `mdMedia` return `/media/...` | add an optional `base = ""` argument; `registry.ts` `resolve()` passes `API_BASE` |

## 3. Auth and session

### 3.1 Better Auth client

New `src/auth/client.ts`:

```ts
import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import { API_BASE, isNative } from "../platform";
import { getToken, setToken } from "./token";

export const authClient = createAuthClient({
  baseURL: `${API_BASE || location.origin}/api/auth`,
  plugins: [magicLinkClient()],
  fetchOptions: isNative ? {
    credentials: "omit",
    auth: { type: "Bearer", token: getToken },
    onSuccess: ({ response }) => { const t = response.headers.get("set-auth-token"); if (t) return setToken(t); },
  } : undefined,
});
```

- Web: cookies, same origin, no token code runs.
- Native: bearer plugin. The server exposes `set-auth-token` in CORS and trusts `capacitor://localhost` and `https://localhost` (backend).
- `src/auth/token.ts`: on native, the token lives in Keychain/Keystore through `@aparajita/capacitor-secure-storage`. `loadToken()` runs once in `main.tsx` before the first API call and keeps it in memory; `getToken()` is sync. On web all three are no-ops. Never store the token in localStorage or `@capacitor/preferences`.

### 3.2 Sign-in methods

| Method | Web | iOS | Android |
|---|---|---|---|
| Email + password | `signIn.email` / `signUp.email` | same | same |
| Magic link (Should) | `signIn.magicLink({ callbackURL: "/#/" })` | link opens the app (section 9.3) | same |
| Google | `signIn.social({ provider: "google", callbackURL: "/#/" })` redirect | native ID token via `@capgo/capacitor-social-login`, then `signIn.social({ provider: "google", idToken: { token } })` | same |
| Apple | redirect (Apple's form POST hits `/api/auth/callback/apple`, outside `guard`) | native ID token, same call with `provider: "apple"` | hidden |

Apple is not offered on Android: App Review requires it only on iOS, and the Android path would need an in-app browser round trip.

Email verification is on, because data migration attaches old rows only to a verified email (plan answer 5). Sign-up ends on a "Check your email" state.

Password reset: `requestPasswordReset({ email, redirectTo: "/#/reset" })`. Better Auth adds `?token=` to the URL, so the token arrives in `location.search`; the reset screen reads it from there and calls `resetPassword({ newPassword, token })`.

### 3.3 Session store

New `src/auth/session.ts`, same pattern as `store.ts`:

```ts
type Me = {
  user: string; email: string; name?: string; admin: boolean;
  features: { billing: boolean; narration: boolean; builder: boolean };
  credits: { balance: number; plan: "free" | "plan"; periodEnd?: string; freeCourse: boolean; costs: Costs; lowAt: number };
};
type Session = { status: "loading" | "signedOut" | "signedIn" | "offline"; me?: Me };
```

- `loadMe()` calls `/api/me`. 200: `signedIn`, cache in `ql.me`. 401: `signedOut`, clear `ql.me`. Network error: `offline` with the cached `ql.me`, or `signedOut` if none.
- After a successful `loadMe()` it runs the user switch (section 3.4) and then `startSync()`. `startSync` no longer fetches `/me` itself.
- `useSession()` hook for screens; `setBalance(n)` for the credits header (section 5).
- `signOut()`: `authClient.signOut()`, clear token, `Purchases.logOut()` on native, clear `ql.me`, set `signedOut`. Local progress stays; the next user switch decides (same as today).

`/me` today returns `{ user, name?, logout? }` (`shared/api-types.ts:62`). The new shape drops `logout` and adds `email`, `admin`, `features`, `credits`. Costs come from the server, not the bundle, so an older mobile build never shows stale prices.

### 3.4 Identity switch without a wipe (codebase risk 3)

`ql.user` holds the lowercased email or `"local"` today. With Better Auth `/me.user` becomes the user id, so `switchUser` (`src/engine/sync.ts:6-14`) would wipe every existing browser once. Change:

```ts
function switchUser(me: { user: string; email: string }): boolean {
  const prev = localStorage.getItem(USER_KEY);
  localStorage.setItem(USER_KEY, me.user);
  // the old key was the email (proxy login) or "local" (self-host); both are this user's own data
  if (prev === null || prev === me.user || prev === me.email.toLowerCase() || prev === "local") return false;
  wipeLocal();
  return true;
}
```

`wipeLocal()` removes `STORAGE_KEY`, `OLD_STORAGE_KEY` (section 10) and `ql.kata.*`. Tests in `sync.test.ts`: email to id keeps data, `"local"` to id keeps data, id A to id B wipes.

`visibleTo` (`registry.ts:59`) compares against emails in a course's `users`. Home and Profile pass `me.email` instead of `ql.user` (`Home.tsx:15-17`, `Profile.tsx:51`).

### 3.5 Gate

`App` renders by session status:

| Status | Renders |
|---|---|
| `loading` with cached `ql.me` | the app (no flash) |
| `loading` without cache | nothing (blank `main.wrap`) |
| `signedOut` | `AuthScreen`, except `#/reset` renders `ResetScreen` |
| `signedIn`, `offline` | the app |

Signed-out use of the bundled library is not offered: every `/api` route needs a user, and a free account already gets every library course. Offline users with a cached session keep full local use.

## 4. API client

`src/answers/api.ts` moves to `src/api.ts` (it is no longer answers-only); `src/answers/api.ts` re-exports for one release of imports, then goes. Core:

```ts
export class ApiError extends Error {
  constructor(public status: number, message: string, public body: Record<string, unknown> = {}) { super(message); }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const t = getToken();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  const res = await fetch(`${API_BASE}/api${path}`, { ...init, headers, credentials: isNative ? "omit" : "same-origin" });
  const bal = res.headers.get("x-credits-balance");
  if (bal !== null) setBalance(Number(bal));
  if (res.status === 401) markSignedOut();
  return res;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 402) openTopUp({ cost: body.cost, balance: body.balance });
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`, body);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
```

- **402**: the server answers before calling the model with `{ error, cost, balance }`. `call()` opens the top-up sheet once; the caller still gets the `ApiError` and returns its UI to the pre-action state (e.g. `WrittenAnswer` back to `edit`, not to the self-rating fallback it uses for 5xx today, `WrittenAnswer.tsx:121-123`).
- **Balance**: every metered response, success or refund, carries `x-credits-balance` (server must expose it in CORS). No response body type changes, and the HUD chip updates in one place.
- **Idempotency**: metered calls send `Idempotency-Key`. The key is made once per user action (`crypto.randomUUID()` when the button is pressed) and reused if the same action is retried after a timeout, so a client retry never double-charges.
- **401** on an API call (expired session) moves the session to `signedOut`; local progress is untouched.
- Multipart uploads use `apiFetch` with a `FormData` body; no JSON content type.

New calls (names to match the backend design):

| Call | Route | Notes |
|---|---|---|
| `gradeAnswer(req, key, signal)` | `POST /api/grade` | `req` gains optional `mockSession` |
| `improveAnswer(answerId, key)` | `POST /api/answers/:id/improve` | returns `{ improved, corrections }`, stored on the answer row |
| `startMock(courseId, key)` | `POST /api/mock` | `{ session }` |
| `getLedger(cursor?)` | `GET /api/credits/ledger` | rows `{ id, delta, reason, label, createdAt }` |
| `checkout(item)` | `POST /api/billing/checkout` | `item: "plan" \| "topup-s" \| "topup-l"` -> `{ url }` |
| `fulfill(sessionId)` | `POST /api/billing/fulfill` | success-page path (BIL-4) |
| `portal()` | `POST /api/billing/portal` | `{ url }` |
| `listCourses()` | `GET /api/courses` | the user's own courses plus those they opened by link |
| `getCourse(id)` | `GET /api/courses/:id` | link or public access |
| `listLibrary(q?)` | `GET /api/library` | public user courses (summaries) |
| `publishCourse(id)` / `unpublishCourse(id)` | `POST /api/courses/:id/publish` / `.../unpublish` | `link -> pending`, back to `link` |
| `uploadCourse(id, file)` | `PUT /api/courses/:id` | re-upload an edited course file (plan answer 7) |
| `deleteCourse(id)` | `DELETE /api/courses/:id` | |
| `uploadSource(file)` | `POST /api/uploads` multipart | `{ id, name, bytes }` |
| `startBuild(input, key)` | `POST /api/jobs` | `{ job }`; 422 `{ error, suggestions }` for vague topics |
| `getJob(id)` / `listJobs()` | `GET /api/jobs/:id`, `GET /api/jobs?active=1` | |
| `getNarration(levelId, voice)` | `GET /api/narration/:level?voice=` | `{ unlocked, url? }` |
| `unlockNarration(levelId, voice, key)` | `POST /api/narration/:level` | `{ url }`; free when already unlocked |
| `reviewQueue()` / `decide(id, ok, reason?)` | `GET /api/admin/queue`, `POST /api/admin/courses/:id` | admins only |
| `flag(itemId, reason)` | `POST /api/flags` | Should (BLD-14) |
| `registerDevice(token)` | `POST /api/push/device` | native push |

## 5. Credits UI

State lives in the session store (`me.credits`); `setBalance` patches it. No separate store.

- **HUD chip** (`src/engine/Hud.tsx`): `<a href="#/profile" class="hud-credits">{balance}</a>` with `aria-label="Credits"`, shown only when `features.billing`. Self-hosters without Stripe never see a credit number or a cost.
- **`AiButton`** (`src/billing/AiButton.tsx`): wraps `.btn`. Label `"{verb} · {cost}"` ("Grade · 2", "Build · 100"); `"{verb} · Free"` when the free course applies; plain verb when billing is off. If `cost >= 100` it opens `Confirm` first.
- **`Confirm`** (`src/billing/Confirm.tsx`): reuses `.overlay` from `Celebrate.tsx:33` with `role="dialog"`. Title "Spend 100 credits?", buttons "Build" / "Cancel". No description.
- **`TopUp`** sheet (`src/billing/TopUp.tsx`): opened by `openTopUp()` from anywhere (402, low-balance notice, Profile). One instance mounted in `App`. Title "Credits", balance as data ("40 · needs 100" when opened from a 402), options "Subscribe · €11.99/mo" (free users only), "500 · €5.99", "1,500 · €14.99". Web: `checkout(item)` then `location.href = url`. Native: RevenueCat (section 9.2); store prices come from the store, never hard-coded.
- **Low balance**: when the balance drops under `credits.lowAt` (server config), one notice per period: a `.wa-notice` "Low on credits" with a "Top up" button in the HUD row. The period end is stored in `ql.lowWarned` so it shows once.
- **Stripe return (web)**: `success_url = {APP_URL}/?checkout={CHECKOUT_SESSION_ID}#/profile`. `main.tsx` reads `checkout` from `location.search`, calls `fulfill`, reloads `/me`, and strips it with `history.replaceState`. A query string avoids relying on template substitution inside a fragment. `cancel_url = {APP_URL}/#/profile`.
- **Profile** (CRD-10): new "Credits" section: balance, plan and renewal ("Plan · renews 22 Dec" / "Free"), buttons "Top up", "Subscribe" (free) or "Manage" (web subscribers, opens the Stripe portal). Below, the ledger as a list: date, label ("Grade", "Course: Rust traits", "Refund", "Monthly credits"), signed delta. "Load more" when the server returns a cursor.
- **Cost changes** (CRD-12, Should): `/me.credits.notice` (server text, e.g. "Mock exams cost 25 from 1 Jan") rendered once as a `.wa-notice` on Home until dismissed (`ql.notice.<hash>`).

## 6. Courses: bundled library plus user courses

### 6.1 Registry becomes appendable

`src/course/registry.ts` keeps the eager glob for `courses/` and `@private/` (the bundled library), and adds a runtime part:

```ts
const listeners = new Set<() => void>();
let version = 0;
/** Adds or replaces DB courses (user-built, link, public). Bundled ids win; a DB course never shadows one. */
export function registerCourses(inputs: CourseInput[]) {
  for (const raw of inputs) {
    const r = CourseSchema.safeParse(raw);
    if (!r.success || BUNDLED.has(r.data.id)) continue;
    const c = resolve(r.data, API_BASE);
    const i = COURSES.findIndex((x) => x.id === c.id);
    if (i >= 0) COURSES.splice(i, 1, c); else COURSES.push(c);
    for (const l of c.levels) for (const ch of l.challenges) CHALLENGES[ch.id] = { ...ch, levelId: l.id };
  }
  version++;
  listeners.forEach((f) => f());
}
export const useCourses = () => { useSyncExternalStore(subscribeCourses, () => version); return COURSES; };
```

- `COURSES` stays an exported array and `CHALLENGES` an exported object, mutated in place, so the sync callers (`App.tsx:31`, `Level.tsx:38`, `Review.tsx:18,33,43`, `Challenge.tsx:394`, `WrittenAnswer.tsx:45`) need no change. `Home` and `App` call `useCourses()` so they re-render when courses arrive.
- Course JSON from the server is still parsed with `CourseSchema` on the client; a bad row is skipped like a bad file today.
- Removing a deleted course: `unregisterCourse(id)` drops it from `COURSES` and its keys from `CHALLENGES`.

### 6.2 Loading

- After sign-in, `loadCourses()` calls `listCourses()` and `registerCourses()`. The result is cached in `ql.courses` so review and play work offline on the next start. `// shortcut: localStorage caps near 5 MB; move to IndexedDB if users keep many large courses`.
- On boot, cached courses register synchronously before the first render, so a deep link to a user course never flashes `NotFound`.
- Unknown course in the route (`App.tsx:31-32`): if `coursesLoaded` is false, render nothing; once loaded, try `getCourse(id)` (link and public courses) and register it; only a 404 shows `NotFound`. Opened link courses are remembered server-side, so they come back in `listCourses()`.

### 6.3 Home and Library

- **Home** (`#/`): bundled courses visible to `me.email`, then the user's own and opened DB courses, then active build jobs as cards ("Building · 3/6") linking to `#/build/:job`. A "New course" card (`.course-card`, plus icon) links to `#/build` when `features.builder`.
- **Library** (`#/library`): approved user courses from `listLibrary(q)` plus the bundled ones, search box (`placeholder="Search"`), cards reuse `.course-card` with author and level count. Opening one goes to `#/c/:id`. Bundled courses are listed here too so the library is one place.
- HUD nav: "Courses", "Library", "Profile", and "Queue" for admins.

## 7. Course builder

Routes `#/build` (form) and `#/build/:job` (progress). Code in `src/builder/`: `machine.ts` (pure reducer, tested), `BuildScreen.tsx`, `JobScreen.tsx`.

### 7.1 Form

Tabs (`role="tablist"`): "Topic", "Files", "Research".

| Mode | Fields | Cost key |
|---|---|---|
| Topic | Topic (text), Level (Beginner / Intermediate / Advanced), Language (select, default UI language) | `topic` (100, or Free) |
| Files | Files (`accept=".pdf,.md,.txt"`, multiple), or URL, or Repo URL; Level; Language | `files` (150) |
| Research | Topic, Level, Language | `research` (200) |

Submit is an `AiButton` ("Build · 100"). Client checks: topic at least 3 characters; each file under the server limit from `/me`; at least one source in Files mode. Uploads start when files are picked (progress per file), so "Build" only sends ids.

### 7.2 State machine

```
form --submit--> confirm (cost >= 100) --ok--> submitting
                       \--cancel--> form
submitting --201 {job}--> watching(job)          route becomes #/build/:job
submitting --402--------> form + TopUp open
submitting --422--------> form + suggestions     ("Try: Rust ownership, Rust async")
submitting --error------> form + notice "Couldn't start"
watching --poll--> watching (stage: queued | outline | writing n/m | validating | fixing k | saving)
watching --done {courseId}--> done               loadCourses(), burst(), "Open" -> #/c/:id
watching --failed---------> failed               notice "Build failed · refunded", "Try again" -> form with the same input
```

- Polling: `getJob(id)` every 2 s while visible, stopped on `visibilitychange` hidden, resumed on visible. `// shortcut: polling, switch to SSE if job volume makes it costly`.
- Reload or a second device: `#/build/:job` starts in `watching`; Home lists active jobs from `listJobs()`.
- Outline (BLD-9): once the job has `outline`, the level titles render as a checklist; written levels get a check. Uses `.bar` for overall progress.
- The mascot reacts through `say()` on stage changes and `react("win")` on done (reuse `src/questie/Questie.tsx`).
- The refund appears as its own ledger row; the job screen shows the balance from the `x-credits-balance` header of the job poll.

## 8. Grading, mock exams, narration

### 8.1 Grade and stronger answer (CRD-8)

`WrittenAnswer.tsx` phases become `edit | grading | graded | improving | improved | rating | rated`.

- "Grade" becomes `AiButton` "Grade · 2".
- `Grade.improved` becomes optional in `shared/api-types.ts`; the grade call no longer returns it.
- After `graded`, a "Stronger answer · 3" button calls `improveAnswer(saved.id)`; `record()` already returns the saved answer, so keep its id in a ref. `GradeView` renders `improved` and a "Corrections" list when present.
- 402 returns to `edit` (grade) or stays in `graded` (improve). Other errors keep today's fallback.
- Previous attempts (`wa-prev`) show the stronger answer if the row has one.

### 8.2 Mock exam (CRD-9)

`Mock.tsx`: "Start" becomes `AiButton` "Start · 20" calling `startMock(course.id)`, then the timer starts. The session id goes to each `WrittenAnswer` as `mockSession`, forwarded in `GradeRequest`, so grading inside the session is not charged. Graded mock answers show "Grade" without a cost.

### 8.3 Narration player

`src/narration/Narration.tsx`, rendered in `Level.tsx` above `<Theory>` during the `theory` phase, only when `features.narration` and the level has theory.

| State | UI |
|---|---|
| `idle` (not unlocked) | `AiButton` "Listen · 10" |
| `unlocking` | button disabled, "Preparing…" |
| `ready` | `<audio controls preload="metadata">` with the URL |
| `error` | `.wa-notice` "Narration unavailable" |

- On mount: `getNarration(levelId, voice)`. If `unlocked`, go straight to `ready` (replays are free).
- Voice: one default from `/me`; a voice picker is not in v1.
- Private course audio: web uses the cookie. Native fetches the URL with the bearer header and plays an object URL (`useAuthedUrl(url)` in `src/auth/useAuthedUrl.ts`, revoked on unmount). The same hook serves private course media in `Block` (`Theory.tsx:23-30`).
- Native background audio needs `UIBackgroundModes: audio` in `Info.plist`. Lock-screen controls through the Media Session API are skipped in v1.

## 9. Capacitor integration

### 9.1 Project

- `capacitor.config.ts` at the repo root: `appId` (owner to pick, e.g. `app.questie`), `appName: "Questie"`, `webDir: "dist"`, `server.androidScheme: "https"`.
- `ios/` and `android/` generated by `npx cap add`; build with `VITE_API_BASE=https://<host> npm run build:app` (`vite build && cap sync`).
- `main.tsx`: do not register `sw.js` on native; call `loadToken()` and native listeners before `createRoot`.
- Android back button: `App.addListener("backButton")` goes `history.back()`, exits on `#/`.
- Dictation: Web Speech is missing in both webviews, so `useDictation().supported` is false and the mic button hides (already handled).
- External links (citations, Stripe is never shown in-app) open in the system browser, which Capacitor does for off-host navigations.

### 9.2 RevenueCat

`src/billing/iap.ts`, loaded only on native:

- After sign-in: `Purchases.configure({ apiKey, appUserID: me.user })` so the webhook maps purchases to the Better Auth id. Sign-out: `Purchases.logOut()`.
- `TopUp` on native lists `getOfferings().current.availablePackages`: the monthly subscription and the two consumable packs, with `product.priceString`.
- `purchasePackage(pkg)` then wait for credits: reload `/me` every 2 s up to 30 s until the balance changes. Show "Pending" meanwhile; after 30 s, "Purchase received" and let the next `/me` catch up. Cancelled purchase: close silently.
- A web subscriber on mobile sees plan status, no "Manage" link (store rules). A store subscriber sees "Manage" opening `customerInfo.managementURL`.
- "Restore purchases" button in the native sheet (required by App Review).

### 9.3 Deep links

- App Links / Universal Links for `https://<host>`, paths `/api/auth/magic-link/verify*`, `/c/*`. The server serves `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` (static files in `public/.well-known/`).
- `App.addListener("appUrlOpen", ({ url }))`:
  - magic link: take `token` from the URL and call `authClient.magicLink.verify({ query: { token } })` with the bearer client, so the session token lands in secure storage, then `loadMe()`.
  - password reset links go to the web page (`/#/reset`); no app handling.
  - `/c/<id>`: set `location.hash = "#/c/<id>"`.
- Share links use the path form `https://<host>/c/<id>` so they can be app links (fragments cannot). On web, `main.tsx` rewrites `/c/<id>` to `/#/c/<id>` with `history.replaceState`; the server already serves `index.html` for extensionless paths (`server/index.ts:34`).
- OAuth on native uses ID tokens (section 3.2), so it needs no redirect deep link. Stripe is web-only, so no Stripe deep link.

### 9.4 Push

`src/engine/push.ts` gets a native branch:

- `pushState()`: `PushNotifications.checkPermissions()` mapped to `off | on | denied`; never `install`.
- `enablePush()`: `requestPermissions()`, `register()`, then the `registration` event's token goes to `registerDevice({ token, platform })`.
- `pushNotificationActionPerformed`: read `data.url` (`/#/c/<course>`, same payload as web push, `server/reminders.ts:41`) and set `location.hash`.
- The Profile reminders UI is unchanged.

## 10. Rename (Questlog -> Questie)

| File | Change |
|---|---|
| `src/engine/store.ts:8` | `STORAGE_KEY = "questie-v1"`, `OLD_STORAGE_KEY = "questlog-v1"` |
| `src/engine/store.ts:153-166` `load()` | order: new key, then old key, then `entrevista-quest-v2` |
| `src/engine/sync.ts:11` | wipe list includes both keys |
| `src/questie/Questie.tsx:85` | key `questie:map:<course>`, read `questlog:questie:<course>` when missing |
| `src/engine/Hud.tsx:48` | brand "Questie" |
| `index.html:13,15` | apple title and `<title>` "Questie" |
| `public/manifest.webmanifest:2-3` | `name`, `short_name` "Questie" |
| `public/sw.js:2,28` | `CACHE = "questie-v1"`, default title "Questie" |
| `src/code/highlighter.ts:6,32` | theme name (internal) |
| `vite.config.ts:6,10`, `tsconfig.json:23` | `QUESTIE_COURSES ?? QUESTLOG_COURSES`; add `questie/authoring`, keep `questlog/authoring` |
| `package.json:2` | `"name": "questie"` (plus lock file) |

`load()` migration:

```ts
const txt = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(OLD_STORAGE_KEY);
if (txt) {
  const p = hydrate(JSON.parse(txt));
  localStorage.setItem(STORAGE_KEY, txt); // copy, never move: an old tab or a rollback still reads questlog-v1
  return p;
}
```

- The old key is copied, not deleted, so a rollback of the deploy loses nothing.
- An old-bundle tab left open keeps writing `questlog-v1` after the new tab copied it; the server sync (newest `updatedAt` wins) carries those writes to the new key on the next load. Acceptable.
- `ql.user`, `ql.kata.*` keep their names (REN-8).
- Tests in `store.test.ts`: old key only -> loaded and copied; both keys -> new key wins; legacy key still migrates.

## 11. New screens and routes

`src/ui/route.ts` gains:

| Route | Hash | Screen |
|---|---|---|
| `library` | `#/library` | `LibraryScreen` |
| `build` | `#/build` | `BuildScreen` |
| `job` | `#/build/:job` | `JobScreen` |
| `admin` | `#/admin` | `QueueScreen` (admins; others get `NotFound`) |
| `reset` | `#/reset` | `ResetScreen` (also reachable signed out) |

`AuthScreen` is not a route; the gate renders it.

### Screens

- **AuthScreen** (`src/auth/AuthScreen.tsx`): title "Sign in" / "Create account" toggle; fields Email, Password (Name on sign-up); buttons "Sign in", "Continue with Google", "Continue with Apple" (web, iOS), "Email me a link" (magic link); link "Forgot password". States: "Check your email" after sign-up or a magic link request; errors as one line ("Wrong email or password").
- **ResetScreen**: "New password" field, "Save" button.
- **QueueScreen**: list of pending courses (title, author email, date, flag count as data "3 flags"); each row "Open" (`#/c/:id`), "Approve", "Reject" (optional reason in a text field). Empty state "Nothing to review".
- **Map head for owned DB courses** (`Map.tsx:37`): status pill ("Private", "Link", "Pending", "Public", "Rejected") reusing `.pill`; buttons "Copy link", "Publish" (link -> pending), "Download" (course JSON), "Upload" (file input, `uploadCourse`), "Delete" (confirm "Delete this course?" + "This can't be undone.").
- **Citations**: theory cards with `sources` render a numbered `<ol class="sources">` of links under the blocks (`Theory.tsx`, after line 74). Needs `sources` on `TheoryCardSchema` (schema owner).
- **Report a problem** (Should): a flag icon button (`aria-label="Report a problem"`) on theory cards and challenge cards for DB courses, opening a small `.overlay` with a reason select and "Send".
- **Profile** additions: Credits section (section 5), "Sign out" button through `signOut()` (replaces the `logout` link, `Profile.tsx:118`), "Delete account" (confirm "Delete your account?" + "This can't be undone."). Account deletion in-app is required by App Review once accounts can be created in the iOS app.

## 12. Components to reuse

| Need | Reuse |
|---|---|
| Screen layout, back link, empty state | `.scr`, `.scr-head`, `.back`, `.scr-empty` (`Profile.tsx`, `Materials.tsx`) |
| Forms | `.profile-form`, `.profile-field`, `.scr-input`, `.wa-actions`, `.wa-notice` |
| Buttons, toggles | `.btn`, `.btn.ghost`, `.iconbtn`, `.switch` |
| Course cards (Home, Library) | `.course-card.card`, `.course-art`, `.bar` (`Home.tsx`) |
| Modal (confirm, top-up, report) | `.overlay` + `role="dialog"` (`Celebrate.tsx:33`, `engine.css:152`) |
| Status chips | `.pill` (`GradeView.tsx` `ScorePill`) |
| Grade display, stronger answer | `GradeView` |
| Job progress bar | `.bar` (`Hud.tsx`, `Home.tsx`) |
| Done celebration | `burst()` (`Celebrate.tsx`), `say()` / `react()` (`Questie.tsx`) |
| Audio and private media | `<audio>` as in `Block` (`Theory.tsx:28`) |
| Markdown | `Md` |
| Stores | `useSyncExternalStore` pattern (`store.ts`, `route.ts`) |
| Errors | `ApiError` |

New components are few: `AiButton`, `Confirm`, `TopUp`, `Narration`, `AuthScreen`, `ResetScreen`, `LibraryScreen`, `BuildScreen`, `JobScreen`, `QueueScreen`.

## 13. Files to touch

New:

| File | Purpose |
|---|---|
| `src/platform.ts` | `isNative`, `platform`, `API_BASE` |
| `src/api.ts` | `apiFetch`, `call`, `ApiError`, all endpoints (moved from `src/answers/api.ts`) |
| `src/auth/client.ts` | Better Auth client |
| `src/auth/token.ts` | secure token storage (native) |
| `src/auth/session.ts` (+ test) | `/me` store, gate status, sign-out |
| `src/auth/AuthScreen.tsx`, `src/auth/ResetScreen.tsx`, `src/auth/auth.css` | sign-in, reset |
| `src/auth/useAuthedUrl.ts` | bearer-fetched media on native |
| `src/billing/AiButton.tsx`, `Confirm.tsx`, `TopUp.tsx`, `billing.css` | cost buttons, confirm, top-up sheet |
| `src/billing/iap.ts` | RevenueCat (native only) |
| `src/builder/machine.ts` (+ test), `BuildScreen.tsx`, `JobScreen.tsx`, `builder.css` | course builder |
| `src/narration/Narration.tsx` | narration player |
| `src/screens/Library.tsx`, `src/screens/Queue.tsx` | library, admin queue |
| `src/native.ts` | back button, `appUrlOpen`, push listeners (native only) |
| `capacitor.config.ts`, `ios/`, `android/` | Capacitor projects |
| `public/.well-known/apple-app-site-association`, `public/.well-known/assetlinks.json` | app links |

Changed:

| File | Change |
|---|---|
| `src/main.tsx` | load token, session, cached courses; `?checkout=` and `/c/<id>` handling; no SW on native; native listeners |
| `src/App.tsx` | gate, new routes, `useCourses()`, wait-then-fetch for unknown courses, mount `TopUp` |
| `src/ui/route.ts` (+ test) | `library`, `build`, `job`, `admin`, `reset` |
| `src/engine/sync.ts` (+ test) | `switchUser(me)` mapping, `apiFetch`, no own `/me` call |
| `src/engine/store.ts` (+ test) | `questie-v1` with copy from `questlog-v1` |
| `src/engine/Hud.tsx` | brand, Library/Queue nav, credits chip, low-balance notice |
| `src/engine/push.ts` | native branch |
| `src/engine/Theory.tsx` | citations, report button, `useAuthedUrl` for media |
| `src/course/registry.ts` (+ `courses.test.ts`) | `registerCourses`, `unregisterCourse`, `useCourses`, `API_BASE` in `resolve` |
| `shared/media.ts` | optional `base` on `mediaUrl`, `mdMedia` |
| `shared/api-types.ts` | `Me`, `Grade.improved` optional, `GradeRequest.mockSession`, new types, route comments |
| `src/answers/api.ts` | re-export from `src/api.ts`, then removed |
| `src/answers/WrittenAnswer.tsx` | `AiButton`, improve phase, 402, `mockSession`, idempotency key |
| `src/answers/GradeView.tsx` | corrections list; improved optional |
| `src/screens/Mock.tsx` | `startMock`, session id |
| `src/screens/Level.tsx` | `Narration` above theory |
| `src/screens/Home.tsx` | `me.email`, DB courses, jobs, "New course" card, notice |
| `src/screens/Map.tsx` | owner actions and status pill |
| `src/screens/Profile.tsx` | credits, ledger, sign-out, delete account, `me.email` |
| `src/questie/Questie.tsx` | storage key rename with fallback |
| `src/code/highlighter.ts` | theme name |
| `index.html`, `public/manifest.webmanifest`, `public/sw.js` | rename |
| `vite.config.ts`, `tsconfig.json`, `package.json` | env and alias fallbacks, name, scripts `build:app`, deps |

New dependencies: `better-auth` (client side of the server dependency), `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`, `@capacitor/app`, `@capacitor/push-notifications`, `@revenuecat/purchases-capacitor`, `@capgo/capacitor-social-login`, `@aparajita/capacitor-secure-storage`.

## 14. Order of work

1. Rename with the storage copy and tests (no server dependency).
2. `platform.ts`, `api.ts` with `apiFetch`; session store, gate, AuthScreen, `switchUser` mapping (needs Better Auth on the server).
3. Credits: HUD chip, `AiButton`, `Confirm`, `TopUp` (web), Profile ledger, 402; grade split and mock session.
4. Appendable registry and course loading; Library; Map owner actions; Queue.
5. Builder screens and machine.
6. Narration player and `useAuthedUrl`.
7. Capacitor: projects, token storage, native sign-in, RevenueCat, deep links, push.

## 15. Tests

- `store.test.ts`: key migration cases (section 10).
- `sync.test.ts`: email -> id and `"local"` -> id keep data; id -> other id wipes.
- `session.test.ts`: 200, 401, network error with and without cache.
- `api` tests: 402 opens top-up once and throws; `x-credits-balance` updates the balance; bearer header only when a token exists.
- `registry` tests: `registerCourses` skips invalid and bundled-id rows, replaces on re-register, fills `CHALLENGES`.
- `machine.test.ts`: every transition in section 7.2.
- `route.test.ts`: new hashes parse and `href` round-trips.
