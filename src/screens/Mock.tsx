import { useEffect, useState } from "react";
import type { Course } from "../course/registry";
import { href } from "../ui/route";
import { Md } from "../ui/Md";
import { WrittenAnswer } from "../answers/WrittenAnswer";
import { ScorePill, ScoreRing } from "../answers/GradeView";
import { pickMockQuestions } from "../answers/mock";
import { average, mmss } from "../answers/text";
import { Hud } from "../engine/Hud";
import "../answers/answers.css";
import "./screens.css";

export function MockScreen({ course }: { course: Course }) {
  const seconds = course.mock?.seconds ?? 30 * 60;
  const [questions] = useState(() => pickMockQuestions(course.levels));
  const [phase, setPhase] = useState<"intro" | "run" | "end">("intro");
  const [endAt, setEndAt] = useState(0);
  const [left, setLeft] = useState(seconds);
  const [i, setI] = useState(0);
  const [scores, setScores] = useState<(number | undefined)[]>([]);

  useEffect(() => {
    if (phase !== "run") return;
    const t = setInterval(() => {
      const s = Math.ceil((endAt - Date.now()) / 1000);
      setLeft(Math.max(0, s));
      if (s <= 0) setPhase("end");
    }, 500);
    return () => clearInterval(t);
  }, [phase, endAt]);

  const start = () => { setEndAt(Date.now() + seconds * 1000); setPhase("run"); };
  const next = () => (i + 1 < questions.length ? setI(i + 1) : setPhase("end"));
  const q = questions[i];
  const answered = scores.filter((s): s is number => s !== undefined);
  const avg = average(answered);

  return (
    <>
    <Hud />
    <div className="scr">
      <div className="scr-head">
        <a className="back" href={href.map(course.id)} aria-label="Map">←</a>
        <h1>{course.mock?.title ?? "Exam"}</h1>
        {phase === "run" && <span className={`mock-clock${left <= 60 ? " low" : ""}`} role="timer" aria-label="Time left">{mmss(left)}</span>}
      </div>

      {phase === "intro" && (
        questions.length ? (
          <div className="mock-bar">
            <span>{questions.length} questions · {mmss(seconds)}</span>
            <button type="button" className="btn" onClick={start}>Start</button>
          </div>
        ) : <p className="scr-empty">No questions</p>
      )}

      {phase === "run" && q && (
        <>
          <div className="mock-bar">
            <span>{i + 1} / {questions.length}</span>
            <button type="button" className={scores[i] === undefined ? "btn ghost" : "btn"} onClick={next}>
              {i + 1 < questions.length ? "Next" : "Finish"}
            </button>
          </div>
          <WrittenAnswer
            key={q.challenge.id}
            challenge={{ ...q.challenge, seconds: undefined }}
            levelId={q.levelId}
            saveOnExit
            onDone={(s) => setScores((xs) => { const c = [...xs]; c[i] = s; return c; })}
          />
        </>
      )}

      {phase === "end" && (
        <>
          <div className="mock-avg">
            {avg !== null ? <ScoreRing score={avg} size={88} /> : null}
            <span>{answered.length} / {questions.length} answered</span>
          </div>
          <ol className="mock-sum">
            {questions.map((x, k) => (
              <li key={x.challenge.id}>
                <Md text={x.challenge.prompt.split("\n")[0]} inline />
                <ScorePill score={scores[k]} />
              </li>
            ))}
          </ol>
          <div className="wa-actions">
            <a className="btn" href={href.answers()}>Answers</a>
          </div>
        </>
      )}
    </div>
    </>
  );
}
