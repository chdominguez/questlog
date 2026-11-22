import { useState } from "react";
import { Lock } from "@phosphor-icons/react";
import type { Course } from "../course/registry";
import { getArt } from "../art";
import { play } from "../audio/sfx";
import { Hud } from "../engine/Hud";
import { dispatch, useProgress } from "../engine/store";
import { isUnlocked } from "../engine/levels";
import { deleteReminder } from "../answers/api";
import { href } from "../ui/route";
import { Stars } from "./Level";
import { MapQuestie } from "../questie/Questie";
import "./screens.css";

const ROW = 184; // px per node row: orb + 3-line title + stars, so rows never overlap
const XS = [50, 76, 50, 24]; // winding x positions, % of width
const ORB_Y = 40; // orb centre from the node top (see .orb in screens.css)

export function MapScreen({ course }: { course: Course }) {
  const p = useProgress();
  const levels = course.levels;
  const done = p.completed.includes(course.id);
  const [denied, setDenied] = useState<string | null>(null);
  const firstOpen = levels.findIndex((l, i) => isUnlocked(levels, i, p) && !p.levels[l.id]?.done);
  const pts = levels.map((_, i) => ({ x: XS[i % XS.length], y: i * ROW + ORB_Y }));
  const h = levels.length * ROW;
  const seg = (i: number) => {
    const a = pts[i], b = pts[i + 1];
    return `M${a.x} ${a.y} C${a.x} ${a.y + ROW / 2} ${b.x} ${b.y - ROW / 2} ${b.x} ${b.y}`;
  };
  const katas = Object.values(course.katas);

  return (
    <>
      <Hud />
      <section className="map-screen screen-in">
        <div className="map-head">
          <h1>{course.title}</h1>
          {course.mock && <a className="btn ghost" href={href.mock(course.id)} onClick={() => play("click")}>{course.mock.title}</a>}
          <button type="button" className="btn ghost" aria-pressed={done}
            onClick={() => {
              dispatch({ type: "complete", course: course.id, on: !done });
              if (!done) deleteReminder(course.id).catch(() => {});
              play("click");
            }}>{done ? "Reopen" : "Mark completed"}</button>
          <label className="switch">
            <input type="checkbox" role="switch" checked={p.unlockAll}
              onChange={(e) => { dispatch({ type: "unlockAll", on: e.target.checked }); play(e.target.checked ? "unlock" : "click"); }} />
            <span className="track" aria-hidden="true" />
            Unlock all
          </label>
        </div>

        {levels.length > 0 && (
          <div className="path" style={{ height: h }}>
            <svg className="path-line" viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" aria-hidden="true">
              {pts.slice(0, -1).map((_, i) => (
                <path key={i} d={seg(i)} className={p.levels[levels[i].id]?.done ? "done" : ""} vectorEffect="non-scaling-stroke" />
              ))}
            </svg>
            <ol className="nodes">
              {levels.map((l, i) => {
                const open = isUnlocked(levels, i, p);
                const lp = p.levels[l.id];
                const art = getArt(l.art);
                const cls = ["node", l.boss && "boss", lp?.done && "done", !open && "locked", i === firstOpen && "current", denied === l.id && "shake"]
                  .filter(Boolean).join(" ");
                const inner = (
                  <>
                    <span className="orb">
                      {art ? <span className="art" dangerouslySetInnerHTML={{ __html: art }} /> : <span className="num">{i + 1}</span>}
                      {!open && <span className="lock"><Lock weight="bold" aria-hidden /></span>}
                    </span>
                    <span className="node-title">{l.title}</span>
                    <Stars n={lp?.stars ?? 0} />
                  </>
                );
                return (
                  <li key={l.id} className={cls} style={{ left: `${pts[i].x}%`, top: i * ROW }}
                    onAnimationEnd={(e) => { if (e.animationName === "shake") setDenied(null); }}>
                    {open ? (
                      <a href={href.level(course.id, l.id)} onClick={() => play("click")}>{inner}</a>
                    ) : (
                      <button type="button" aria-disabled="true" aria-label={`${l.title}, locked`}
                        onClick={() => { play("bad"); setDenied(l.id); }}>{inner}</button>
                    )}
                  </li>
                );
              })}
            </ol>
            <MapQuestie course={course.id} pts={pts} at={firstOpen >= 0 ? firstOpen : levels.length - 1} row={ROW} />
          </div>
        )}

        {katas.length > 0 && (
          <section className="dojo" aria-labelledby="dojo-title">
            <h2 id="dojo-title">Dojo</h2>
            <ul className="dojo-list">
              {katas.map((k) => (
                <li key={k.id}>
                  <a className="kata-chip" href={href.kata(course.id, k.id)} onClick={() => play("click")}>
                    <b>{k.title}</b>
                    <span className={`diff d-${k.difficulty}`}>{k.difficulty}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </>
  );
}
