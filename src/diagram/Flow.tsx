import { useEffect, useRef, type CSSProperties } from "react";
import type { FlowStep } from "../course/schema";
import { Md } from "../ui/Md";
import { Snippet } from "../code/Snippet";
import { StepControls, useStepper } from "../engine/Stepper";
import "./flow.css";

/** A request hopping between actors, one step at a time, with the payload of the current hop. */
export function Flow({ actors, steps, caption }: { actors: string[]; steps: FlowStep[]; caption?: string }) {
  const s = useStepper(steps.length, 2400);
  const step = steps[s.i];
  const n = actors.length;
  const scroller = useRef<HTMLDivElement>(null);

  // On narrow screens the lanes scroll sideways: keep the current hop in view.
  useEffect(() => {
    const c = scroller.current;
    const a = c?.querySelector(".flow-row.now .flow-arrow");
    if (!c || !a || c.scrollWidth <= c.clientWidth) return;
    const cr = c.getBoundingClientRect(), ar = a.getBoundingClientRect();
    c.scrollTo({ left: c.scrollLeft + ar.left - cr.left + ar.width / 2 - c.clientWidth / 2, behavior: "smooth" });
  }, [s.i]);

  return (
    <figure className="flow">
      <div ref={scroller} className="flow-scroll" tabIndex={0} role="group" aria-label={caption ?? "Flow"}>
        <div className="flow-lanes" style={{ "--n": n } as CSSProperties}>
          {actors.map((a, k) => (
            <span key={a} className="flow-actor" style={{ gridColumn: k + 1 }}>{a}</span>
          ))}
          {actors.map((a, k) => (
            <i key={a} className="flow-life" aria-hidden="true" style={{ left: `${((k + 0.5) / n) * 100}%` }} />
          ))}
          {steps.map((t, k) => {
            const a = actors.indexOf(t.from);
            const b = actors.indexOf(t.to);
            const lo = Math.min(a, b);
            const state = k < s.i ? "done" : k === s.i ? "now" : "todo";
            const style = {
              left: `${((lo + 0.5) / n) * 100}%`,
              width: `${(Math.abs(b - a) / n) * 100}%`,
            } as CSSProperties;
            return (
              <div key={k} className={`flow-row ${state}`} aria-current={state === "now" ? "step" : undefined}>
                <div className={`flow-arrow${b < a ? " flow-rev" : ""}${a === b ? " flow-self" : ""}`} style={style}>
                  <span className="flow-label">{t.label}</span>
                  {state === "now" && <i key={s.i} className="flow-dot" aria-hidden="true" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <StepControls {...s} />
      <div className="flow-payload">
        {step.data ? (
          <Snippet lang={step.lang ?? "json"} src={step.data} title={`${step.from} → ${step.to}: ${step.label}`} />
        ) : (
          <p className="flow-hop">{step.from} → {step.to}: {step.label}</p>
        )}
        {step.note && <Md text={step.note} />}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
