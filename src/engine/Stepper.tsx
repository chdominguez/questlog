import { useEffect, useState } from "react";

/** Index into `n` steps with prev/next and autoplay that stops on the last step. */
export function useStepper(n: number, ms = 1600) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (i >= n - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setI(i + 1), ms);
    return () => clearTimeout(t);
  }, [playing, i, n, ms]);

  const prev = () => { setPlaying(false); setI((k) => Math.max(0, k - 1)); };
  const next = () => { setPlaying(false); setI((k) => Math.min(n - 1, k + 1)); };
  const toggle = () => {
    if (!playing && i >= n - 1) setI(0);
    setPlaying(!playing);
  };
  return { i, n, playing, prev, next, toggle };
}

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

export function StepControls({ i, n, playing, prev, next, toggle }: ReturnType<typeof useStepper>) {
  return (
    <div className="stepper">
      <button type="button" className="step-btn" onClick={prev} disabled={i === 0} aria-label="Previous step">{icon("M15 6l-6 6 6 6")}</button>
      <button type="button" className="step-btn play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
        {playing ? icon("M9 6v12M15 6v12") : icon("M8 5.5v13l10-6.5z")}
      </button>
      <button type="button" className="step-btn" onClick={next} disabled={i >= n - 1} aria-label="Next step">{icon("M9 6l6 6-6 6")}</button>
      <span className="count-label" aria-live="polite">{i + 1}/{n}</span>
    </div>
  );
}
