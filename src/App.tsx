import { lazy, Suspense, useEffect, useState } from "react";
import { useHash, useRoute } from "./ui/route";
import { unlock } from "./audio/sfx";
import { courseById, coursesLoaded, useCourses } from "./course/registry";
import { HomeScreen } from "./screens/Home";
import { MapScreen } from "./screens/Map";
import { LevelScreen } from "./screens/Level";
import { ReviewScreen } from "./screens/Review";
import { AnswersScreen } from "./screens/Answers";
import { MaterialsScreen } from "./screens/Materials";
import { ProfileScreen } from "./screens/Profile";
import { NoteScreen, NotesScreen } from "./screens/Notes";
import { MockScreen } from "./screens/Mock";
import { NotFound } from "./screens/NotFound";
import { ArcadeScreen } from "./games/Arcade";
import { GameScreen } from "./games/Game";
import { KataScreen } from "./code/KataScreen";
import { q } from "./course/registry";
import { Gate } from "./auth/Gate";
import { useSession } from "./auth/session";
import { TopUpSheet } from "./billing/TopUpSheet";
import { fetchCourse } from "./builder/api";
import { ErrorBoundary } from "./ui/ErrorBoundary";

// Screens most sessions never open load on demand, keeping them out of the main chunk.
const PlansScreen = lazy(() => import("./billing/PlansScreen").then((m) => ({ default: m.PlansScreen })));
const BillingDoneScreen = lazy(() => import("./billing/BillingDoneScreen").then((m) => ({ default: m.BillingDoneScreen })));
const CreditsScreen = lazy(() => import("./billing/CreditsScreen").then((m) => ({ default: m.CreditsScreen })));
const BuildScreen = lazy(() => import("./builder/BuildScreen").then((m) => ({ default: m.BuildScreen })));
const JobScreen = lazy(() => import("./builder/JobScreen").then((m) => ({ default: m.JobScreen })));
const WelcomeScreen = lazy(() => import("./screens/Welcome").then((m) => ({ default: m.WelcomeScreen })));
const LibraryScreen = lazy(() => import("./screens/Library").then((m) => ({ default: m.LibraryScreen })));
const QueueScreen = lazy(() => import("./library/QueueScreen").then((m) => ({ default: m.QueueScreen })));

export function App() {
  const r = useRoute();
  const hash = useHash();
  useEffect(() => { scrollTo(0, 0); }, [hash]); // a new screen starts at the top
  useEffect(() => {
    // Every gesture, not once: the first one can come before zzfx loads, and Safari suspends audio again
    // in background tabs. pointerup/touchend because a touch pointerdown doesn't count as a gesture.
    const evs = ["pointerdown", "pointerup", "touchend", "keydown"] as const;
    evs.forEach((e) => addEventListener(e, unlock, true));
    return () => evs.forEach((e) => removeEventListener(e, unlock, true));
  }, []);
  useCourses(); // re-render when runtime courses arrive
  const admin = useSession().me?.admin ?? false;
  const course = "course" in r ? courseById(r.course) : undefined;
  // A course not in the registry may be a link course: try the server once, then NotFound.
  const missing = "course" in r && !course ? r.course : null;
  const loaded = coursesLoaded();
  const [tried, setTried] = useState<string[]>([]);
  useEffect(() => {
    if (!missing || !loaded || tried.includes(missing)) return;
    fetchCourse(missing).catch(() => false).then(() => setTried((t) => [...t, missing]));
  }, [missing, loaded, tried]);
  if (missing) return <Gate><main className="wrap">{loaded && tried.includes(missing) && <NotFound />}</main></Gate>;
  return (
    <Gate>
    <main className="wrap">
      <ErrorBoundary>
      <Suspense fallback={null}>
      {r.name === "home" && <HomeScreen />}
      {r.name === "map" && course && <MapScreen course={course} />}
      {r.name === "level" && course && <LevelScreen course={course} id={q(course.id, r.id)} />}
      {r.name === "kata" && course && <KataScreen course={course} kataId={q(course.id, r.id)} />}
      {r.name === "mock" && course && <MockScreen course={course} />}
      {r.name === "arcade" && course && <ArcadeScreen course={course} />}
      {r.name === "game" && course && <GameScreen key={r.game} course={course} game={r.game} />}
      {r.name === "review" && course && <ReviewScreen course={course} />}
      {r.name === "answers" && course && <AnswersScreen course={course} />}
      {r.name === "materials" && course && <MaterialsScreen course={course} />}
      {r.name === "profile" && <ProfileScreen />}
      {r.name === "notes" && course && (r.id ? <NoteScreen course={course} id={r.id} /> : <NotesScreen course={course} />)}
      {r.name === "credits" && <CreditsScreen />}
      {r.name === "welcome" && <WelcomeScreen />}
      {r.name === "plans" && <PlansScreen canceled={r.canceled} />}
      {r.name === "billingDone" && <BillingDoneScreen />}
      {r.name === "build" && <BuildScreen />}
      {r.name === "job" && <JobScreen id={r.id} />}
      {r.name === "library" && <LibraryScreen />}
      {r.name === "adminReview" && (admin ? <QueueScreen /> : <NotFound />)}
      </Suspense>
      </ErrorBoundary>
      <TopUpSheet />
    </main>
    </Gate>
  );
}
