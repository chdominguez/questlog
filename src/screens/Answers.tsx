import { useEffect, useMemo, useState } from "react";
import type { SavedAnswer } from "../../shared/api-types";
import { courseOf, type Course } from "../course/registry";
import { href } from "../ui/route";

import { Md } from "../ui/Md";
import { listAnswers } from "../answers/api";
import { toMarkdown } from "../../shared/export";
import { groupAnswers, scoreOf } from "../../shared/group";
import { GradeView, ScorePill } from "../answers/GradeView";
import { fmtDate, SOURCE_LABEL } from "../answers/text";
import { Hud } from "../engine/Hud";
import "../answers/answers.css";
import "./screens.css";

// Built here, not by GET /api/export, so it gets level titles and local time.
function download(all: SavedAnswer[], levels: { id: string; title: string }[]) {
  const md = toMarkdown(all, levels, (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
  a.download = "answers.md";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function AnswersScreen({ course }: { course: Course }) {
  const levels = useMemo(() => course.levels.map((l) => ({ id: l.id, title: l.title })), [course]);
  const [all, setAll] = useState<SavedAnswer[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => { listAnswers().then((xs) => setAll(xs.filter((a) => courseOf(a.challengeId) === course.id)), () => setError(true)); }, [course.id]);
  const groups = useMemo(() => groupAnswers(all ?? [], levels, filter), [all, levels, filter]);

  return (
    <>
    <Hud />
    <div className="scr">
      <div className="scr-head">
        <a className="back" href={href.map(course.id)} aria-label={course.title}>←</a>
        <h1>Answers</h1>
        <button type="button" className="btn ghost" disabled={!all?.length} onClick={() => all && download(all, levels)}>Export .md</button>
      </div>
      <input className="scr-input" type="search" placeholder="Filter" aria-label="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {error && <p className="scr-empty" role="alert">Couldn't load answers</p>}
      {all && groups.length === 0 && <p className="scr-empty">No answers</p>}
      {groups.map((l) => (
        <section key={l.levelId} className="ans-level">
          <h2>{l.title}</h2>
          {l.challenges.map((ch) => (
            <details key={ch.challengeId} className="ans-ch">
              <summary>
                <Md text={ch.prompt.split("\n")[0]} inline />
                <span className="ans-count">{ch.attempts.length}×</span>
                <ScorePill score={ch.best} />
              </summary>
              <div className="ans-body">
                {ch.attempts.map((a) => (
                  <details key={a.id} className="ans-try">
                    <summary>
                      <span>{fmtDate(a.createdAt)}</span>
                      <span>{SOURCE_LABEL[a.source]}</span>
                      <ScorePill score={scoreOf(a)} />
                    </summary>
                    <div className="ans-try-body wa">
                      <p>{a.answer}</p>
                      {a.grade && <GradeView grade={a.grade} />}
                    </div>
                  </details>
                ))}
              </div>
            </details>
          ))}
        </section>
      ))}
    </div>
    </>
  );
}
