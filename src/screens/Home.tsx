import { useEffect } from "react";
import { Star } from "@phosphor-icons/react";
import { COURSE_ERRORS, coursesLoaded, useCourses, visibleTo } from "../course/registry";
import { useSession } from "../auth/session";
import { JobCards } from "../builder/JobCards";
import { loadCourses, useUserCourses } from "../builder/api";
import { StatusPill } from "../library/StatusPill";
import { refreshMetas } from "../library/api";
import { isDemo } from "../platform";
import { getArt } from "../art";
import { play } from "../audio/sfx";
import { Hud } from "../engine/Hud";
import { useProgress } from "../engine/store";
import { courseDue } from "../engine/srs";
import { href } from "../ui/route";
import "./screens.css";
import "../builder/builder.css";

export function HomeScreen() {
  const p = useProgress();
  const session = useSession();
  const all = useCourses();
  const courses = visibleTo(session.me?.email ?? "", all); // course `users` lists hold emails, not account ids
  const { status, metas } = useUserCourses();
  const mine = new Set(metas.filter((m) => m.mine).map((m) => m.id));
  const ai = session.me?.features.ai ?? false;
  useEffect(() => { if (!isDemo) void refreshMetas(); }, []);
  // Signed in after a failed load (e.g. signed out at start): load again.
  useEffect(() => { if (session.status === "signedIn" && status === "error") void loadCourses(); }, [session.status]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Hud />
      <section className="home screen-in">
        <h1 className="sr">Courses</h1>
        {!isDemo && <JobCards />}
        <ul className="home-courses">
          {courses.map((c) => {
            const done = c.levels.filter((l) => p.levels[l.id]?.done).length;
            const stars = c.levels.reduce((n, l) => n + (p.levels[l.id]?.stars ?? 0), 0);
            const due = courseDue(p, c.id, Date.now()).length;
            const art = getArt(c.levels.find((l) => !p.levels[l.id]?.done)?.art ?? c.levels[0]?.art);
            return (
              <li key={c.id}>
                <a className="course-card card" href={href.map(c.id)} onClick={() => play("click")}>
                  <span className="course-art">
                    {art ? <span className="art" dangerouslySetInnerHTML={{ __html: art }} /> : <span className="num">{c.title[0]}</span>}
                  </span>
                  <span className="course-body">
                    <b>{c.title}</b>{mine.has(c.id) && <> <StatusPill courseId={c.id} /></>}
                    {c.summary && <span className="course-summary">{c.summary}</span>}
                    <span className="course-meta">{done}/{c.levels.length} levels · {stars}<Star weight="fill" aria-hidden /><span className="sr">stars</span>{p.completed.includes(c.id) ? " · Completed" : due > 0 ? ` · ${due} due` : ""}</span>
                    <span className="bar" aria-hidden="true"><span style={{ transform: `scaleX(${c.levels.length ? done / c.levels.length : 0})` }} /></span>
                  </span>
                </a>
              </li>
            );
          })}
          {!coursesLoaded() && <li aria-hidden="true"><span className="course-card card course-skeleton" /></li>}
        </ul>
        {status === "error" && (
          <p className="wa-notice home-empty" role="alert">Couldn't load courses <button type="button" className="btn ghost" onClick={() => void loadCourses()}>Retry</button></p>
        )}
        {courses.length === 0 && coursesLoaded() && (
          <div className="home-empty">
            <p className="scr-empty">No courses</p>
            {ai && <a className="btn" href={href.build()}>Build course</a>}
            <a className="btn ghost" href={href.library()}>Browse library</a>
          </div>
        )}
        {COURSE_ERRORS.map((e) => (
          <details key={e.file} className="course-error card" role="alert">
            <summary>Invalid course: {e.file}</summary>
            <pre>{e.error}</pre>
          </details>
        ))}
      </section>
    </>
  );
}
