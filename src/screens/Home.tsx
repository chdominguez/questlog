import { COURSES, COURSE_ERRORS } from "../course/registry";
import { getArt } from "../art";
import { play } from "../audio/sfx";
import { Hud } from "../engine/Hud";
import { useProgress } from "../engine/store";
import { dueKeys } from "../engine/srs";
import { href } from "../ui/route";
import "./screens.css";

export function HomeScreen() {
  const p = useProgress();
  const due = dueKeys(p.cards, Date.now()).length;
  return (
    <>
      <Hud />
      <section className="home screen-in">
        <h1 className="sr">Courses</h1>
        {due > 0 && (
          <a className="home-due card" href={href.review()} onClick={() => play("click")}>
            <b>{due}</b> due for review
          </a>
        )}
        <ul className="home-courses">
          {COURSES.map((c) => {
            const done = c.levels.filter((l) => p.levels[l.id]?.done).length;
            const stars = c.levels.reduce((n, l) => n + (p.levels[l.id]?.stars ?? 0), 0);
            const art = getArt(c.levels.find((l) => !p.levels[l.id]?.done)?.art ?? c.levels[0]?.art);
            return (
              <li key={c.id}>
                <a className="course-card card" href={href.map(c.id)} onClick={() => play("click")}>
                  <span className="course-art">
                    {art ? <span className="art" dangerouslySetInnerHTML={{ __html: art }} /> : <span className="num">{c.title[0]}</span>}
                  </span>
                  <span className="course-body">
                    <b>{c.title}</b>
                    {c.summary && <span className="course-summary">{c.summary}</span>}
                    <span className="course-meta">{done}/{c.levels.length} levels · {stars}★</span>
                    <span className="bar" aria-hidden="true"><span style={{ width: `${(done / c.levels.length) * 100}%` }} /></span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
        {COURSES.length === 0 && <p className="scr-empty">No courses</p>}
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
