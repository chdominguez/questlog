import { useEffect, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import type { Course } from "../course/registry";
import { href } from "../ui/route";
import { Md, summaryLine } from "../ui/Md";
import { WrittenAnswer } from "../answers/WrittenAnswer";
import { ScorePill, ScoreRing } from "../answers/GradeView";
import { pickMockQuestions, resumable, storeMock } from "../answers/mock";
import { ApiError, startMock } from "../answers/api";
import { newKey } from "../api";
import { useSession } from "../auth/session";
import { CostButton } from "../billing/CostButton";
import { isDemo } from "../platform";
import { average, mmss } from "../answers/text";
import { Hud } from "../engine/Hud";
import "../answers/answers.css";
import "./screens.css";

export function MockScreen({ course }: { course: Course }) {
  const seconds = course.mock?.seconds ?? 30 * 60;
  const [resume] = useState(() => resumable(course.id, course.levels));
  const [questions] = useState(() => resume?.questions ?? pickMockQuestions(course.levels));
  const [phase, setPhase] = useState<"intro" | "run" | "end" | "failed">(resume ? "run" : "intro");
  const [mockId, setMockId] = useState(resume?.mockId);
  const [endAt, setEndAt] = useState(resume?.endAt ?? 0);
  const [left, setLeft] = useState(seconds);
  const [i, setI] = useState(resume?.i ?? 0);
  const [scores, setScores] = useState<(number | undefined)[]>(() => resume?.scores.map((x) => x ?? undefined) ?? []);
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);
  const me = useSession().me;
  const ai = me?.features.ai !== false;

  useEffect(() => {
    if (phase === "end" || phase === "failed") storeMock(course.id, null);
    if (phase !== "run") return;
    storeMock(course.id, { mockId, endAt, i, ids: questions.map((q) => q.challenge.id), scores: scores.map((x) => x ?? null) });
  }, [phase, mockId, endAt, i, scores, questions, course.id]);

  useEffect(() => {
    if (phase !== "run") return;
    const t = setInterval(() => {
      const s = Math.ceil((endAt - Date.now()) / 1000);
      setLeft(Math.max(0, s));
      if (s <= 0) setPhase("end");
    }, 500);
    return () => clearInterval(t);
  }, [phase, endAt]);

  async function start() {
    setStarting(true);
    setFailed(false);
    try {
      if (!isDemo) setMockId((await startMock(course.id, newKey())).mockId);
      setI(0);
      setScores([]);
      setEndAt(Date.now() + seconds * 1000);
      setPhase("run");
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 402)) setFailed(true); // 402 opened the top-up sheet
    }
    setStarting(false);
  }
  const next = () => (i + 1 < questions.length ? setI(i + 1) : setPhase("end"));
  const q = questions[i];
  const answered = scores.filter((s): s is number => s !== undefined);
  const avg = average(answered);

  return (
    <>
    <Hud />
    <div className="scr">
      <div className="scr-head">
        <a className="back" href={href.map(course.id)} aria-label="Map"><ArrowLeft aria-hidden /></a>
        <h1>{course.mock?.title ?? "Exam"}</h1>
        {phase === "run" && <span className={`mock-clock${left <= 60 ? " low" : ""}`} role="timer" aria-label="Time left">{mmss(left)}</span>}
      </div>

      {phase === "intro" && (
        !ai ? <p className="scr-empty">No grader</p> : questions.length ? (
          <div className="mock-bar">
            <span>{questions.length} questions · {mmss(seconds)}</span>
            {isDemo
              ? <button type="button" className="btn" onClick={start}>Start</button>
              : <CostButton action="mock" label="Start" busy={starting} busyLabel="Starting…" onPress={start} />}
          </div>
        ) : <p className="scr-empty">No questions</p>
      )}
      {phase === "failed" && (
        <div className="mock-bar">
          <span className="wa-error" role="alert">Exam failed{me?.credits ? ` · ${me.credits.costs.mock} credits refunded` : ""}</span>
          <CostButton action="mock" label="Try again" busy={starting} busyLabel="Starting…" onPress={start} />
        </div>
      )}
      {failed && <p className="wa-error" role="alert">Couldn't start exam</p>}

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
            mockId={mockId}
            onMockFailed={() => setPhase("failed")}
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
                <Md text={summaryLine(x.challenge.prompt)} inline />
                <ScorePill score={scores[k]} />
              </li>
            ))}
          </ol>
          <div className="wa-actions">
            <a className="btn" href={href.answers(course.id)}>Answers</a>
          </div>
        </>
      )}
    </div>
    </>
  );
}
