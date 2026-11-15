import { useEffect, useState } from "react";
import type { Challenge } from "../course/schema";
import { Md } from "../ui/Md";
import { typingTarget } from "./Theory";
import { FLASH_RATINGS, ratingForKey } from "./flashcard";
import type { Result } from "./store";

export function Flashcard({ c, done, onRate }: {
  c: Extract<Challenge, { type: "flashcard" }>; done: boolean; onRate: (r: Result, easy?: boolean) => void;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (done || typingTarget(e) || e.altKey || e.ctrlKey || e.metaKey) return;
      if (!shown) {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); setShown(true); }
        return;
      }
      const r = ratingForKey(e.key);
      if (r) onRate(r.result, r.easy);
    };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, [shown, done, onRate]);

  if (!shown) {
    return <button type="button" className="btn fc-reveal" autoFocus aria-keyshortcuts="Space Enter" onClick={() => setShown(true)}>Reveal</button>;
  }
  return (
    <>
      <div className="fc-back"><Md text={c.back} /></div>
      {c.explain && <Md text={c.explain} />}
      {!done && (
        <div className="fc-rate" role="group" aria-label="Rate">
          {FLASH_RATINGS.map((r, i) => (
            <button key={r.label} type="button" className="btn ghost fc-btn" aria-keyshortcuts={String(i + 1)} onClick={() => onRate(r.result, r.easy)}>{r.label}</button>
          ))}
        </div>
      )}
    </>
  );
}
