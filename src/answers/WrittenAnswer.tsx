import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Microphone } from "@phosphor-icons/react";
import type { Challenge } from "../course/schema";
import type { Grade, SavedAnswer } from "../../shared/api-types";
import { Md } from "../ui/Md";
import { Snippet } from "../code/Snippet";
import { play } from "../audio/sfx";
import { ApiError, gradeAnswer, improveAnswer, listAnswers, saveAnswer } from "./api";
import { newKey } from "../api";
import { useSession } from "../auth/session";
import { CostButton } from "../billing/CostButton";
import { isDemo } from "../platform";
import { useDictation } from "./useDictation";
import { GradeView, ScorePill, Stronger } from "./GradeView";
import { fmtDate, insertAt, mmss, SELF_RATINGS, SOURCE_LABEL, sourceOf } from "./text";
import { scoreOf } from "../../shared/group";
import { courseById, courseOf } from "../course/registry";
import "./answers.css";

type Written = Extract<Challenge, { type: "written" }>;
type Phase = "edit" | "grading" | "graded" | "improving" | "rating" | "rated";

const MAX = 8000; // matches server MAX_ANSWER

export function WrittenAnswer({ challenge, levelId, onDone, saveOnExit = false, mockId, onMockFailed }: {
  challenge: Written; levelId: string; onDone: (score: number) => void;
  /** Save whatever is written, ungraded, if the component unmounts before the answer was saved (mock clock). */
  saveOnExit?: boolean;
  /** Paid mock session: grading inside it is free. */
  mockId?: string;
  /** The mock's first grade failed and the server refunded the exam. */
  onMockFailed?: () => void;
}) {
  const { me } = useSession();
  const ai = me?.features.ai !== false;
  /** " · <n> credits refunded" when billing is on and the action was paid. */
  const refunded = (cost: "grade" | "improve") => (me?.credits ? ` · ${me.credits.costs[cost]} credits refunded` : "");
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("edit");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [selfScore, setSelfScore] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [left, setLeft] = useState(challenge.seconds ?? 0);
  const [previous, setPrevious] = useState<SavedAnswer[]>([]);
  const [improveFailed, setImproveFailed] = useState(false);
  const [answerId, setAnswerId] = useState<string | null>(null);
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
    const a = await record(extra).catch(() => { setNotice("Couldn't save"); return null; });
    setAnswerId(a?.id ?? null);
  }

  async function correct() {
    if (!editing || !text.trim() || !ai || isDemo) return;
    setPhase("grading");
    setNotice("");
    abort.current = new AbortController();
    try {
      const g = await gradeAnswer({ challengeId: challenge.id, answer: text.trim(), ...(mockId && { mockId }) }, newKey(), abort.current.signal);
      setGrade(g);
      setPhase("graded");
      await save({ grade: g });
      onDone(g.score);
    } catch (e) {
      if (abort.current?.signal.aborted) return; // unmounted
      if (e instanceof ApiError && (e.status === 400 || e.status === 402)) {
        if (e.status === 400) setNotice(e.message); // 402 opened the top-up sheet; the answer stays for a retry
        setPhase("edit");
      } else if (mockId && e instanceof ApiError && e.body.refunded === true) {
        onMockFailed?.();
      } else {
        const timeout = e instanceof DOMException && e.name === "TimeoutError";
        const paid = !mockId && (timeout || (e instanceof ApiError && e.body.refunded === true));
        setNotice(`${timeout ? "Grader timed out" : "Grader unavailable"}${paid ? refunded("grade") : ""}`);
        setPhase("rating");
      }
    }
  }

  async function improve() {
    if (!grade || !answerId || phase !== "graded") return;
    setPhase("improving");
    setNotice("");
    try {
      const imp = await improveAnswer(answerId, newKey());
      setGrade({ ...grade, ...imp });
      setImproveFailed(false);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 402)) {
        setImproveFailed(true);
        setNotice(`Couldn't write it${e instanceof ApiError && e.body.refunded === true ? refunded("improve") : ""}`);
      }
    }
    setPhase("graded");
  }

  async function rate(score: number) {
    setSelfScore(score);
    setPhase("rated");
    if (text.trim()) await save({ selfScore: score });
    onDone(score);
  }

  const toggleMic = () => (dict.recording ? dict.stop() : (area.current?.focus(), dict.start()));
  const syncCaret = () => { caret.current = area.current?.selectionStart ?? textRef.current.length; };
  const graded = phase === "graded" || phase === "improving";
  const showModel = graded || phase === "rating" || phase === "rated";

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
            <Microphone size={20} weight={dict.recording ? "fill" : "regular"} aria-hidden />
          </button>
        )}
      </div>
      {dict.interim && <p className="wa-interim" aria-live="polite">{dict.interim}</p>}
      {dict.recording && !dict.interim && <p className="wa-interim" aria-live="polite">Listening…</p>}
      {dict.error && <p className="wa-error" role="alert">{dict.error}</p>}
      {notice && <p className="wa-notice" role="status">{notice}</p>}

      {(phase === "edit" || phase === "grading") && (
        <div className="wa-actions">
          {ai && (mockId ? (
            <button type="button" className="btn" onClick={correct} disabled={!text.trim() || phase === "grading"} aria-keyshortcuts="Control+Enter Meta+Enter">
              {phase === "grading" ? "Grading…" : "Grade"}
            </button>
          ) : (
            <CostButton action="grade" label="Grade" busy={phase === "grading"} busyLabel="Grading…" disabled={!text.trim()} keyshortcuts="Control+Enter Meta+Enter" onPress={correct} />
          ))}
          <button type="button" className="btn ghost" onClick={() => setPhase("rating")} disabled={phase === "grading"}>
            Show model answer
          </button>
        </div>
      )}

      {grade && graded && <GradeView grade={grade} />}

      {showModel && (
        <section className="wa-model">
          <h4>Model answer</h4>
          <Md text={challenge.model} />
          {challenge.explain && <Md text={challenge.explain} className="wa-explain" />}
        </section>
      )}

      {grade && graded && !grade.improved && answerId && (
        <div className="wa-actions">
          <CostButton action="improve" label={improveFailed ? "Retry" : "Stronger answer"} busy={phase === "improving"} busyLabel="Writing…" className="btn ghost" onPress={improve} />
        </div>
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
                {a.grade && <Stronger grade={a.grade} />}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
