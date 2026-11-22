import { useMemo } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import type { Course } from "../course/registry";
import { mediaByLevel } from "../course/materials";
import { href } from "../ui/route";
import { Block } from "../engine/Theory";
import { Hud } from "../engine/Hud";
import { Sources } from "../engine/Sources";
import "../answers/answers.css";
import "./screens.css";

export function MaterialsScreen({ course }: { course: Course }) {
  const media = useMemo(() => new Map(mediaByLevel(course).map((g) => [g.level.id, g.items])), [course]);
  // Every level with media or cited sources (deduped by URL), in course order.
  const groups = useMemo(() => course.levels.map((level) => ({
    level,
    items: media.get(level.id) ?? [],
    sources: [...new Map(level.theory.flatMap((t) => t.sources ?? []).map((s) => [s.url, s])).values()],
  })).filter((g) => g.items.length || g.sources.length), [course, media]);
  return (
    <>
    <Hud />
    <div className="scr">
      <div className="scr-head">
        <a className="back" href={href.map(course.id)} aria-label={course.title}><ArrowLeft aria-hidden /></a>
        <h1>Materials</h1>
      </div>
      {groups.length === 0 && <p className="scr-empty">No media</p>}
      {groups.map(({ level, items, sources }) => (
        <section key={level.id} className="ans-level">
          <h2>{level.title}</h2>
          {items.map(({ block }, i) => <Block key={i} b={block} />)}
          <Sources sources={sources} />
        </section>
      ))}
    </div>
    </>
  );
}
