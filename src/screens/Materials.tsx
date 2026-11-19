import { useMemo } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import type { Course } from "../course/registry";
import { mediaByLevel } from "../course/materials";
import { href } from "../ui/route";
import { Block } from "../engine/Theory";
import { Hud } from "../engine/Hud";
import "../answers/answers.css";
import "./screens.css";

export function MaterialsScreen({ course }: { course: Course }) {
  const groups = useMemo(() => mediaByLevel(course), [course]);
  return (
    <>
    <Hud />
    <div className="scr">
      <div className="scr-head">
        <a className="back" href={href.map(course.id)} aria-label={course.title}><ArrowLeft aria-hidden /></a>
        <h1>Materials</h1>
      </div>
      {groups.length === 0 && <p className="scr-empty">No media</p>}
      {groups.map(({ level, items }) => (
        <section key={level.id} className="ans-level">
          <h2>{level.title}</h2>
          {items.map(({ block }, i) => <Block key={i} b={block} />)}
        </section>
      ))}
    </div>
    </>
  );
}
