import { useState } from "react";
import type { Challenge } from "../course/schema";
import { Md } from "../ui/Md";
import { Snippet } from "../code/Snippet";
import { play } from "../audio/sfx";
import { ChallengeBody, Feedback, KICKER } from "./Challenge";
import type { Result } from "./store";

/** A challenge inline in theory: same inputs and feedback, never recorded. */
export function Practice({ c }: { c: Challenge }) {
  const [attempt, setAttempt] = useState(0);
  return <PracticeRun key={attempt} c={c} onAgain={() => { play("click"); setAttempt((a) => a + 1); }} />;
}

function PracticeRun({ c, onAgain }: { c: Challenge; onAgain: () => void }) {
  const [result, setResult] = useState<Result | null>(null);
  const finish = (r: Result) => {
    if (result) return;
    play(r === "ok" ? "ok" : r === "partial" ? "submit" : "bad");
    setResult(r);
  };
  return (
    <div className="practice">
      <div className="qtype">{KICKER[c.type]}</div>
      <Md text={c.prompt} />
      {c.code && <Snippet lang={c.code.lang} src={c.code.src} />}
      <ChallengeBody c={c} done={result !== null} onResult={finish} />
      {result && <Feedback c={c} result={result} />}
      {result && result !== "ok" && (
        <div className="row end">
          <button type="button" className="btn ghost" onClick={onAgain}>Again</button>
        </div>
      )}
    </div>
  );
}
