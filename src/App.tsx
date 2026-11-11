import { useEffect } from "react";
import { useRoute } from "./ui/route";
import { unlock } from "./audio/sfx";
import { courseById } from "./course/registry";
import { HomeScreen } from "./screens/Home";
import { MapScreen } from "./screens/Map";
import { LevelScreen } from "./screens/Level";
import { ReviewScreen } from "./screens/Review";
import { AnswersScreen } from "./screens/Answers";
import { MockScreen } from "./screens/Mock";
import { NotFound } from "./screens/NotFound";
import { KataScreen } from "./code/KataScreen";
import { q } from "./course/registry";

export function App() {
  const r = useRoute();
  useEffect(() => {
    // Every gesture, not once: the first one can come before zzfx loads, and Safari suspends audio again
    // in background tabs. pointerup/touchend because a touch pointerdown doesn't count as a gesture.
    const evs = ["pointerdown", "pointerup", "touchend", "keydown"] as const;
    evs.forEach((e) => addEventListener(e, unlock, true));
    return () => evs.forEach((e) => removeEventListener(e, unlock, true));
  }, []);
  const course = "course" in r ? courseById(r.course) : undefined;
  if ("course" in r && !course) return <main className="wrap"><NotFound /></main>;
  return (
    <main className="wrap">
      {r.name === "home" && <HomeScreen />}
      {r.name === "map" && course && <MapScreen course={course} />}
      {r.name === "level" && course && <LevelScreen course={course} id={q(course.id, r.id)} />}
      {r.name === "kata" && course && <KataScreen course={course} kataId={q(course.id, r.id)} />}
      {r.name === "mock" && course && <MockScreen course={course} />}
      {r.name === "review" && <ReviewScreen />}
      {r.name === "answers" && <AnswersScreen />}
      {r.name === "notes" && <HomeScreen />}
    </main>
  );
}
