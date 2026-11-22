import { useCallback, useEffect, useState } from "react";
import type { UserCourseMeta } from "../../shared/api-types";
import { useSession } from "../auth/session";
import { useCourses, visibleTo } from "../course/registry";
import { getArt } from "../art";
import { play } from "../audio/sfx";
import { Hud } from "../engine/Hud";
import { filterLibrary, isUserCourse, listLibrary, type LibraryFilter, type LibraryItem } from "../library/api";
import { href } from "../ui/route";
import "../library/library.css";
import "./screens.css";

const FILTERS: [LibraryFilter, string][] = [["all", "All"], ["questie", "Questie"], ["community", "Community"]];

/** Bundled courses plus approved user courses, searched and filtered on the client. */
export function LibraryScreen() {
  const email = useSession().me?.email ?? "";
  const courses = useCourses();
  const [community, setCommunity] = useState<UserCourseMeta[]>([]);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("all");

  const load = useCallback(() => {
    setFailed(false);
    listLibrary().then(setCommunity, () => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const items: LibraryItem[] = [
    ...visibleTo(email, courses).filter((c) => !isUserCourse(c.id)).map((c) => ({
      id: c.id, title: c.title, summary: c.summary ?? "", levels: c.levels.length, author: "Questie", cited: false, community: false,
    })),
    ...community.map((m) => ({ id: m.id, title: m.title, summary: m.summary ?? "", levels: m.levels, author: m.author, cited: m.mode === "web", community: true })),
  ];
  const shown = filterLibrary(items, query, filter);
  const art = (id: string) => getArt(courses.find((c) => c.id === id)?.levels[0]?.art);

  return (
    <>
      <Hud />
      <section className="home screen-in lib-search">
        <h1>Library</h1>
        <input className="scr-input" type="search" aria-label="Search courses" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="lib-tabs">
          {FILTERS.map(([f, label]) => (
            <button key={f} type="button" className="btn ghost" aria-pressed={filter === f} onClick={() => setFilter(f)}>{label}</button>
          ))}
        </div>
        <p className="sr" role="status">{query ? `${shown.length} ${shown.length === 1 ? "course" : "courses"}` : ""}</p>
        {failed && <p className="scr-empty" role="alert">Couldn't load library <button type="button" className="btn ghost" onClick={load}>Retry</button></p>}
        <ul className="home-courses">
          {shown.map((c) => {
            const a = art(c.id);
            return (
              <li key={c.id}>
                <a className="course-card card" href={href.map(c.id)} onClick={() => play("click")}>
                  <span className="course-art">
                    {a ? <span className="art" dangerouslySetInnerHTML={{ __html: a }} /> : <span className="num">{c.title[0]}</span>}
                  </span>
                  <span className="course-body">
                    <b>{c.title}</b>
                    {c.summary && <span className="course-summary">{c.summary}</span>}
                    <span className="course-meta">{c.levels} levels · {c.author}{c.cited && <span className="tag">Cited</span>}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
        {shown.length === 0 && <p className="scr-empty">{items.length ? "No matches" : "No courses"}</p>}
      </section>
    </>
  );
}
