import type { Grade } from "../../shared/api-types";
import "./answers.css";

const tone = (s: number) => (s >= 7 ? "ok" : s >= 4 ? "mid" : "bad");

export function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const r = 15.9;
  const c = 2 * Math.PI * r;
  return (
    <svg className={`ring ring-${tone(score)}`} width={size} height={size} viewBox="0 0 36 36" role="img" aria-label={`${score} out of 10`}>
      <circle cx="18" cy="18" r={r} className="ring-track" />
      <circle cx="18" cy="18" r={r} className="ring-bar" strokeDasharray={`${(score / 10) * c} ${c}`} transform="rotate(-90 18 18)" />
      <text x="18" y="18" dominantBaseline="central" textAnchor="middle">{score}</text>
    </svg>
  );
}

export const ScorePill = ({ score }: { score?: number }) =>
  score === undefined ? <span className="pill">—</span> : <span className={`pill pill-${tone(score)}`}>{score}/10</span>;

function List({ title, items, kind }: { title: string; items: string[]; kind: string }) {
  if (!items.length) return null;
  return (
    <section className={`gv-list gv-${kind}`}>
      <h4>{title}</h4>
      <ul>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </section>
  );
}

export function GradeView({ grade }: { grade: Grade }) {
  return (
    <div className="gv">
      <div className="gv-head">
        <ScoreRing score={grade.score} />
        <div className="gv-lists">
          <List title="Covered" items={grade.covered} kind="ok" />
          <List title="Missing" items={grade.missing} kind="mid" />
          <List title="Mistakes" items={grade.mistakes} kind="bad" />
        </div>
      </div>
      {grade.improved && (
        <section className="gv-improved">
          <h4>Stronger answer</h4>
          <p>{grade.improved}</p>
        </section>
      )}
    </div>
  );
}
