import { useEffect, useState } from "react";
import type { Job } from "../../shared/api-types";
import { href } from "../ui/route";
import { getJob, listJobs, loadCourses, seenJobs } from "./api";
import { initialView, reduce, steps, STEP_LABEL, type JobView } from "./machine";
import "./builder.css";

const DAY = 24 * 60 * 60 * 1000;

/** Running builds (with progress) and failed builds not opened yet, newest first, for Home. */
export function JobCards() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [views, setViews] = useState<Record<string, JobView>>({});
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let running = 0;
    const tick = async () => {
      try {
        const seen = seenJobs();
        const js = (await listJobs()).filter((j) => j.status === "queued" || j.status === "running"
          || (j.status === "failed" && !seen.includes(j.id) && Date.now() - Date.parse(j.finishedAt ?? j.createdAt) < DAY));
        const active = js.filter((j) => j.status !== "failed");
        const polls = await Promise.all(active.map((j) => getJob(j.id).catch(() => null)));
        if (stopped) return;
        if (active.length < running) void loadCourses(); // a build finished: pick up its course
        running = active.length;
        setJobs(js);
        setViews(Object.fromEntries(polls.flatMap((p) => (p ? [[p.job.id, reduce(initialView, p)]] : []))));
        if (active.length && !document.hidden) timer = setTimeout(tick, 3000);
      } catch { /* offline: no cards */ }
    };
    void tick();
    return () => { stopped = true; clearTimeout(timer); };
  }, []);
  if (!jobs.length) return null;
  return (
    <ul className="home-courses">
      {jobs.map((j) => {
        const v = views[j.id];
        const cur = v && steps(v).find((s) => s.state === "current");
        const w = v?.write;
        const label = j.status === "failed" ? null : cur?.stage === "write" && w ? `Building ${w.done} / ${w.of}` : cur ? STEP_LABEL[cur.stage] : "Building";
        return (
          <li key={j.id}>
            <a className="job-card card" href={href.job(j.id)}>
              <span className="job-card-head">
                <b>{v?.title ?? j.title ?? ""}</b>
                {label ? <span>{label}</span> : <span className="pill pill-bad">Build failed</span>}
              </span>
              {label && w && (
                <span className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={w.of} aria-valuenow={w.done} aria-valuetext={`${w.done} of ${w.of} levels`}>
                  <span style={{ transform: `scaleX(${w.of ? w.done / w.of : 0})` }} />
                </span>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
