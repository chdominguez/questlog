import type { CodeLang, TraceStep } from "../course/schema";
import { Md } from "../ui/Md";
import { StepControls, useStepper } from "../engine/Stepper";
import { Snippet } from "./Snippet";
import "./snippet.css";

/** A hand-written run of `src`: one highlighted line per step, with the values in scope. */
export function Trace({ lang, src, title, steps }: { lang: CodeLang; src: string; title?: string; steps: TraceStep[] }) {
  const s = useStepper(steps.length);
  const step = steps[s.i];
  const before: Record<string, string> = Object.assign({}, ...steps.slice(0, s.i).map((t) => t.vars));
  const now = { ...before, ...step.vars };

  return (
    <div className="trace">
      <Snippet lang={lang} src={src} title={title} highlight={[step.line]} />
      <StepControls {...s} />
      {Object.keys(now).length > 0 && (
        <dl className="trace-vars">
          {Object.entries(now).map(([k, v]) => {
            const changed = s.i > 0 && before[k] !== v;
            // keyed on the step so the flash restarts each time the value changes
            return (
              <div key={changed ? `${k}:${s.i}` : k} className={changed ? "changed" : undefined}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            );
          })}
        </dl>
      )}
      {step.note && <Md text={step.note} className="trace-note" />}
    </div>
  );
}
