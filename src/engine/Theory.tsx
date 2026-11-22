import { useEffect, useState } from "react";
import type { TheoryBlock, TheoryCard } from "../course/schema";
import { Md } from "../ui/Md";
import { Snippet } from "../code/Snippet";
import { Mermaid } from "../diagram/Mermaid";
import { Flow } from "../diagram/Flow";
import { Trace } from "../code/Trace";
import { getArt } from "../art";
import { play } from "../audio/sfx";
import { Drill } from "./Drill";
import { Practice } from "./Practice";
import { say } from "../questie/Questie";
import { courseOf } from "../course/registry";
import { ReportButton } from "../library/ReportButton";
import { Sources } from "./Sources";
import "./engine.css";

export function Block({ b }: { b: TheoryBlock }) {
  switch (b.kind) {
    case "md": return <Md text={b.text} />;
    case "code": return <Snippet lang={b.lang} src={b.src} title={b.title} highlight={b.highlight} />;
    case "mermaid": return <Mermaid src={b.src} caption={b.caption} />;
    case "trace": return <Trace lang={b.lang} src={b.src} title={b.title} steps={b.steps} />;
    case "flow": return <Flow actors={b.actors} steps={b.steps} caption={b.caption} />;
    case "drill": return <Drill b={b} />;
    case "practice": return <Practice c={b.challenge} />;
    case "media": return (
      <figure className="media">
        {b.type === "image" && <img src={b.src} alt={b.alt} loading="lazy" decoding="async" />}
        {b.type === "video" && <video src={b.src} poster={b.poster} aria-label={b.alt} controls playsInline preload="metadata" />}
        {b.type === "audio" && <audio src={b.src} aria-label={b.alt} controls />}
        {b.caption && <figcaption>{b.caption}</figcaption>}
      </figure>
    );
    case "figure": {
      const svg = getArt(b.art);
      return (
        <figure className="figure">
          {svg && <div className="figure-art" aria-hidden={!b.caption} dangerouslySetInnerHTML={{ __html: svg }} />}
          {b.caption && <figcaption>{b.caption}</figcaption>}
        </figure>
      );
    }
  }
}

export const typingTarget = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || !!t.closest?.(".monaco-editor"));
};

/** Card-by-card theory with progress dots; arrows navigate. `level` (qualified key) enables per-card reports. */
export function Theory({ cards, onDone, level }: { cards: TheoryCard[]; onDone: () => void; level?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => { scrollTo(0, 0); }, [i]);
  const last = i >= cards.length - 1;
  const goTo = (n: number) => { if (n >= 0 && n < cards.length && n !== i) { play("click"); setI(n); } };
  const next = () => (last ? onDone() : goTo(i + 1));

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (typingTarget(e) || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goTo(i - 1); }
    };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  });

  const card = cards[i];
  useEffect(() => { say(card?.tip, true); }, [card]);
  if (!card) return null;
  return (
    <section className="theory" aria-label="Theory">
      <article key={i} className="card theory-card screen-in">
        <h2>{card.title}</h2>
        {level && <ReportButton courseId={courseOf(level)} itemId={`${level}#${i}`} />}
        {card.blocks.map((b, k) => <Block key={k} b={b} />)}
        <Sources sources={card.sources} />
      </article>
      <div className="theory-nav">
        <button type="button" className="btn ghost" onClick={() => goTo(i - 1)} disabled={i === 0}>Previous</button>
        <div className="dots" role="tablist" aria-label="Cards">
          {cards.map((c, k) => (
            <button key={k} type="button" role="tab" aria-selected={k === i} aria-label={c.title}
              className={k === i ? "on" : k < i ? "seen" : ""} onClick={() => goTo(k)} />
          ))}
        </div>
        <span className="count-label theory-count">{i + 1}/{cards.length}</span>
        <button type="button" className="btn" onClick={next} autoFocus>{last ? "Start challenges" : "Next"}</button>
      </div>
    </section>
  );
}
