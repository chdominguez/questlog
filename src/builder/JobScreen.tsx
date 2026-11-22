import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check } from "@phosphor-icons/react";
import { ApiError } from "../api";
import { useSession } from "../auth/session";
import { CostButton } from "../billing/CostButton";
import { courseById, useCourses, type Course } from "../course/registry";
import { Hud } from "../engine/Hud";
import { ShareButton } from "../library/ShareButton";
import { Questie } from "../questie/Questie";
import { go, href } from "../ui/route";
import { getJob, loadCourses, loadDraft, markJobSeen, saveDraft } from "./api";
import { ACTION, useStartBuild } from "./BuildScreen";
import { initialView, reduce, steps, STEP_LABEL, type JobView, type StepState } from "./machine";
import "../answers/answers.css";
import "../screens/screens.css";
import "./builder.css";

const MARK: Record<StepState, string> = { done: "✓", current: "●", waiting: "○" };
const STATE_TEXT: Record<StepState, string> = { done: "done", current: "in progress", waiting: "waiting" };
const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;

/** `8 levels · 64 challenges · 6 katas · 9 challenge types` (+ sources). */
export function stats(c: Course): string {
  const chs = c.levels.flatMap((l) => l.challenges);
  const katas = Object.keys(c.katas).length;
  const sources = new Set(c.levels.flatMap((l) => l.theory.flatMap((t) => (t.sources ?? []).map((s) => s.url)))).size;
  return [
    n(c.levels.length, "level", "levels"), n(chs.length, "challenge", "challenges"), ...(katas ? [n(katas, "kata", "katas")] : []),
    n(new Set(chs.map((x) => x.type)).size, "challenge type", "challenge types"), ...(sources ? [n(sources, "source", "sources")] : []),
  ].join(" · ");
}

/** Polls the job every 2 s while the page is visible; backs off while the connection is lost. */
function useJob(id: string) {
  const [view, setView] = useState<JobView>(initialView);
  const [lost, setLost] = useState(false);
  const [missing, setMissing] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delay = 2000;
    let stopped = false;
    const tick = async () => {
      timer = undefined;
      try {
        const p = await getJob(id, seq.current);
        if (stopped) return;
        seq.current = Math.max(seq.current, ...p.events.map((e) => e.seq));
        setView((v) => reduce(v, p));
        setLost(false);
        delay = 2000;
        if (p.job.status === "done" || p.job.status === "failed") return;
      } catch (e) {
        if (stopped) return;
        if (e instanceof ApiError && e.status === 404) { setMissing(true); return; }
        setLost(true);
        delay = Math.min(delay * 2, 30_000);
      }
      if (!document.hidden) timer = setTimeout(tick, delay);
    };
    const onVisible = () => { if (!document.hidden && !timer) void tick(); };
    void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [id]);
  return { view, lost, missing };
}

export function JobScreen({ id }: { id: string }) {
  const { view, lost, missing } = useJob(id);
  const job = view.job;
  const me = useSession().me;
  const result = useRef<HTMLHeadingElement>(null);
  const draft = loadDraft(id);
  const { busy, start } = useStartBuild();
  useCourses();
  const courseId = job?.result?.courseId;
  const course = courseId ? courseById(courseId) : undefined;
  const ended = job?.status === "done" || job?.status === "failed";

  useEffect(() => {
    if (!ended) return;
    result.current?.focus();
    if (job.status === "failed") markJobSeen(id);
    if (job.status === "done") void loadCourses();
  }, [ended, job?.status, id]);

  if (missing) {
    return (
      <><Hud />
        <div className="scr job">
          <h1>Build not found</h1>
          <a className="btn" href={href.home()}>Courses</a>
        </div>
      </>
    );
  }

  const title = view.title ?? job?.title ?? "";
  const ss = steps(view);
  const current = ss.find((s) => s.state === "current");
  const cost = job?.mode && me?.credits ? me.credits.costs[ACTION[job.mode]] : null;
  const err = job?.error;
  const refund = !err?.refunded ? null : err.free ? "Free course restored" : cost !== null ? `${cost} credits refunded` : null;
  const edit = () => { if (draft) saveDraft(null, draft); go(href.build()); };

  return (
    <>
      <Hud />
      <div className="scr job">
        <div className="scr-head">
          <a className="back" href={href.home()} aria-label="Courses"><ArrowLeft aria-hidden /></a>
          <h1>{title}</h1>
        </div>
        <Questie mood={job?.status === "done" ? "cheer" : job?.status === "failed" ? "sad" : "think"} />

        {job?.status === "done" && (
          <>
            <h2 ref={result} tabIndex={-1}>Course ready</h2>
            {course && <p className="job-stats">{stats(course)}</p>}
            <div className="job-actions">
              <a className="btn" href={href.map(courseId!)} autoFocus>Start</a>
              <ShareButton courseId={courseId!} />
            </div>
          </>
        )}

        {job?.status === "failed" && (
          <>
            <h2 ref={result} tabIndex={-1}>Build failed</h2>
            {refund && <p><span className="pill pill-ok">{refund}</span></p>}
            <div className="job-actions">
              {draft && <CostButton action={ACTION[draft.req.mode]} label="Try again" free={!!err?.free} busy={busy} onPress={() => start(draft.req, draft.files)} />}
              <button type="button" className="btn ghost" onClick={edit}>Edit</button>
            </div>
          </>
        )}

        {job && !ended && (
          <>
            <p className="sr" aria-live="polite">{current ? STEP_LABEL[current.stage] : ""}</p>
            <ol className="job-steps">
              {ss.map((s) => (
                <li key={s.stage} data-state={s.state}>
                  <span aria-hidden="true">{MARK[s.state]}</span>
                  <span>{STEP_LABEL[s.stage]}<span className="sr">, {STATE_TEXT[s.state]}</span></span>
                  <span className="job-step-extra">
                    {s.stage === "research" && view.sources !== null && n(view.sources, "source", "sources")}
                    {s.stage === "write" && view.write && s.state === "current" && `${view.write.done} / ${view.write.of}`}
                    {s.stage === "validate" && s.state === "current" && view.issues !== null && `Fixing ${n(view.issues, "issue", "issues")}`}
                  </span>
                  {s.stage === "write" && s.state === "current" && view.write && (
                    <span className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={view.write.of} aria-valuenow={view.write.done} aria-valuetext={`${view.write.done} of ${view.write.of} levels`}>
                      <span style={{ transform: `scaleX(${view.write.of ? view.write.done / view.write.of : 0})` }} />
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}

        {lost && <p className="wa-notice" role="status">Connection lost</p>}

        {view.levels.length > 0 && job?.status !== "failed" && (
          <section>
            <h2>Outline</h2>
            <ol className="job-outline">
              {view.levels.map((l) => (
                <li key={l.id}>{l.title}{(l.status !== "waiting" || job?.status === "done") && <><Check weight="bold" className="build-ok" aria-hidden /><span className="sr">done</span></>}</li>
              ))}
            </ol>
          </section>
        )}

        {job && !ended && <a className="btn ghost" href={href.home()}>Courses</a>}
      </div>
    </>
  );
}
