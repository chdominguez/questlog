import { useMemo } from "react";
import { Lock } from "@phosphor-icons/react";
import type { Course } from "../course/registry";
import { play } from "../audio/sfx";
import { Hud } from "../engine/Hud";
import { useProgress } from "../engine/store";
import { href } from "../ui/route";
import { fmt, GAMES } from "./Game";
import { buildPool } from "./pool";
import "./games.css";

export function ArcadeScreen({ course }: { course: Course }) {
  const p = useProgress();
  const pool = useMemo(() => buildPool(course.levels, p), [course, p.levels, p.unlockAll]);
  return (
    <>
      <Hud />
      <section className="arcade">
        <h1>Arcade</h1>
        <ul className="arcade-cards">
          {GAMES.map((g) => {
            const best = p.best[`${course.id}:${g.id}`];
            const open = g.size(pool) >= g.min;
            const inner = (
              <>
                <g.Icon weight="duotone" className="arcade-icon" aria-hidden="true" />
                <b>{g.name}</b>
                {open
                  ? best !== undefined && <span className="arcade-best">Best {fmt(g, best)}</span>
                  : <Lock className="arcade-lock" aria-label="Locked" role="img" />}
              </>
            );
            return (
              <li key={g.id}>
                {open
                  ? <a className="arcade-card" href={href.game(course.id, g.id)} onClick={() => play("click")}>{inner}</a>
                  : <div className="arcade-card off" aria-disabled="true">{inner}</div>}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
