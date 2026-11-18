import { useEffect, useState } from "react";
import { CaretLeft, CaretRight, Pause, Play } from "@phosphor-icons/react";

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

export function StepControls({ i, n, playing, prev, next, toggle }: ReturnType<typeof useStepper>) {
  return (
    <div className="stepper">
      <button type="button" className="step-btn" onClick={prev} disabled={i === 0} aria-label="Previous step"><CaretLeft weight="bold" aria-hidden /></button>
      <button type="button" className="step-btn play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
        {playing ? <Pause weight="fill" aria-hidden /> : <Play weight="fill" aria-hidden />}
      </button>
      <button type="button" className="step-btn" onClick={next} disabled={i >= n - 1} aria-label="Next step"><CaretRight weight="bold" aria-hidden /></button>
      <span className="count-label" aria-live="polite">{i + 1}/{n}</span>
    </div>
  );
}
