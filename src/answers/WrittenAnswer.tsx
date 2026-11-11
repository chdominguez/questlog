import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Challenge } from "../course/schema";
import type { Grade, SavedAnswer } from "../../shared/api-types";
import { Md } from "../ui/Md";
import { Snippet } from "../code/Snippet";
import { play } from "../audio/sfx";
import { ApiError, gradeAnswer, listAnswers, saveAnswer } from "./api";
import { useDictation } from "./useDictation";
import { GradeView, ScorePill } from "./GradeView";
import { fmtDate, insertAt, mmss, scoreOf, SELF_RATINGS, SOURCE_LABEL, sourceOf } from "./text";
import { courseById, courseOf } from "../course/registry";
import "./answers.css";

type Written = Extract<Challenge, { type: "written" }>;
type Phase = "edit" | "grading" | "graded" | "rating" | "rated";

const MAX = 8000; // matches server MAX_ANSWER

export function WrittenAnswer({ challenge, levelId, onDone, saveOnExit = false }: {
  challenge: Written; levelId: string; onDone: (score: number) => void;
  /** Save whatever is written, ungraded, if the component unmounts before the answer was saved (mock clock). */
  saveOnExit?: boolean;
}) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("edit");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [selfScore, setSelfScore] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [left, setLeft] = useState(challenge.seconds ?? 0);
  const [previous, setPrevious] = useState<SavedAnswer[]>([]);
  const used = useRef({ typed: false, dictated: false });
  const startedAt = useRef(Date.now());
  const area = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef("");
  const caret = useRef(0);
  const pendingCaret = useRef<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const phaseRef = useRef<Phase>("edit");
  phaseRef.current = phase;
  const saved = useRef(false);

  const editing = phase === "edit";
  const lang = courseById(courseOf(challenge.id))?.lang;

  const dict = useDictation((chunk) => {
    if (phaseRef.current !== "edit") return; // a final result can land after stop(), once grading started
    const r = insertAt(textRef.current, caret.current, chunk);
    textRef.current = r.text.slice(0, MAX);
    caret.current = Math.min(r.pos, MAX);
    pendingCaret.current = caret.current;
    used.current.dictated = true;
    setText(textRef.current);
  }, lang);

  useEffect(() => {
    let live = true;
    listAnswers(challenge.id).then((xs) => live && setPrevious(xs), () => {});
    return () => { live = false; };
  }, [challenge.id]);

  const record = (extra: Pick<SavedAnswer, "grade" | "selfScore">) => {
    saved.current = true;
    return saveAnswer({
      challengeId: challenge.id, levelId, prompt: challenge.prompt, answer: textRef.current.trim(),
      source: sourceOf(used.current.typed, used.current.dictated),
      seconds: Math.round((Date.now() - startedAt.current) / 1000),
      ...extra,
    });
  };

  useEffect(() => () => {
    abort.current?.abort();
    if (saveOnExit && !saved.current && textRef.current.trim()) record({}).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!challenge.seconds || !editing) return;
    // Soft limit: past zero it counts overtime instead of cutting the answer off.
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [challenge.seconds, editing]);

  useEffect(() => {
    if (challenge.seconds && editing && left > 0 && left <= 10) play("tick");
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!editing) dict.stop(); }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
    if (pendingCaret.current !== null && document.activeElement === el) el.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [text]);

  async function save(extra: Pick<SavedAnswer, "grade" | "selfScore">) {
    await record(extra).catch(() => setNotice("Couldn't save"));
  }

  async function correct() {
    if (!editing || !text.trim()) return;
    setPhase("grading");
    setNotice("");
    abort.current = new AbortController();
    try {
      const g = await gradeAnswer(
        { challengeId: challenge.id, prompt: challenge.prompt, model: challenge.model, keyPoints: challenge.keyPoints, answer: text.trim() },
        abort.current.signal,
      );
      setGrade(g);
      setPhase("graded");
      await save({ grade: g });
      onDone(g.score);
    } catch (e) {
      if (abort.current?.signal.aborted) return; // unmounted
      if (e instanceof ApiError && e.status === 400) {
        setNotice(e.message);
        setPhase("edit");
      } else {
        setNotice(e instanceof DOMException && e.name === "TimeoutError" ? "Grader timed out" : "Grader unavailable");
        setPhase("rating");
      }
    }
  }

  async function rate(score: number) {
    setSelfScore(score);
    setPhase("rated");
    if (text.trim()) await save({ selfScore: score });
    onDone(score);
  }

  const toggleMic = () => (dict.recording ? dict.stop() : (area.current?.focus(), dict.start()));
  const syncCaret = () => { caret.current = area.current?.selectionStart ?? textRef.current.length; };
  const showModel = phase === "graded" || phase === "rating" || phase === "rated";

  return (
    <div className="wa card">
      <div className="wa-prompt">
        <Md text={challenge.prompt} />
        {challenge.seconds ? (
          <span className={`wa-timer${left <= 10 ? " wa-timer-low" : ""}`} role="timer" aria-label={left < 0 ? "Overtime" : "Time left"}>{left < 0 ? `+${mmss(-left)}` : mmss(left)}</span>
        ) : null}
      </div>
      {challenge.code && <Snippet lang={challenge.code.lang} src={challenge.code.src} />}

      <div className={`wa-field${dict.recording ? " is-rec" : ""}`}>
        <textarea
          ref={area}
          value={text}
          rows={4}
          maxLength={MAX}
          readOnly={!editing}
          aria-label="Your answer"
          onChange={(e) => {
            textRef.current = e.target.value;
            used.current.typed = true;
            setText(e.target.value);
            syncCaret();
          }}
          onSelect={syncCaret}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); correct(); }
          }}
        />
        {dict.supported && editing && (
          <button
            type="button"
            className={`wa-mic${dict.recording ? " on" : ""}`}
            aria-label={dict.recording ? "Stop dictation" : "Dictate"}
            aria-pressed={dict.recording}
            onClick={toggleMic}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
              <path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      {dict.interim && <p className="wa-interim" aria-live="polite">{dict.interim}</p>}
      {dict.recording && !dict.interim && <p className="wa-interim" aria-live="polite">Listening…</p>}
      {dict.error && <p className="wa-error" role="alert">{dict.error}</p>}
      {notice && <p className="wa-notice" role="status">{notice}</p>}

      {(phase === "edit" || phase === "grading") && (
        <div className="wa-actions">
          <button type="button" className="btn" onClick={correct} disabled={!text.trim() || phase === "grading"} aria-keyshortcuts="Control+Enter Meta+Enter">
            {phase === "grading" ? "Grading…" : "Grade"}
          </button>
          <button type="button" className="btn ghost" onClick={() => setPhase("rating")} disabled={phase === "grading"}>
            Show model answer
          </button>
        </div>
      )}

      {grade && phase === "graded" && <GradeView grade={grade} />}

      {showModel && (
        <section className="wa-model">
          <h4>Model answer</h4>
          <Md text={challenge.model} />
          {challenge.explain && <Md text={challenge.explain} className="wa-explain" />}
        </section>
      )}

      {phase === "rating" && (
        <div className="wa-actions" role="group" aria-label="Self-rating">
          {SELF_RATINGS.map((r) => (
            <button key={r.label} type="button" className="btn ghost" disabled={!text.trim() && r.score > 2} onClick={() => rate(r.score)}>{r.label}</button>
          ))}
        </div>
      )}
      {phase === "rated" && selfScore !== null && <p className="wa-self"><ScorePill score={selfScore} /></p>}

      {previous.length > 0 && (
        <details className="wa-prev">
          <summary>Previous attempts ({previous.length})</summary>
          <ul>
            {previous.map((a) => (
              <li key={a.id}>
                <div className="wa-prev-meta">
                  <span>{fmtDate(a.createdAt, lang)}</span>
                  <span>{SOURCE_LABEL[a.source]}</span>
                  <ScorePill score={scoreOf(a)} />
                </div>
                <p>{a.answer}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
