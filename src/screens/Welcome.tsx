import { useEffect, useRef, useState } from "react";
import type { SkillLevel } from "../../shared/api-types";
import { useSession } from "../auth/session";
import { BuildButton, pressBuild, TopicField, LevelField, useStartBuild } from "../builder/BuildScreen";
import { useUserCourses } from "../builder/api";
import { checkForm, emptyForm } from "../builder/machine";
import { COURSES } from "../course/registry";
import { Hud } from "../engine/Hud";
import { useProgress } from "../engine/store";
import { Questie } from "../questie/Questie";
import { go, href } from "../ui/route";
import "../answers/answers.css";
import "./screens.css";
import "../builder/builder.css";

const key = (user: string) => `ql.welcomed.${user}`;
export const welcomed = (user: string) => { try { return !!localStorage.getItem(key(user)); } catch { return true; } };
const markWelcomed = (user?: string) => { try { if (user) localStorage.setItem(key(user), "1"); } catch { /* off */ } };

/** Onboarding, once per account: only for accounts with no progress and no courses of their own. */
export function WelcomeScreen() {
  const me = useSession().me;
  const progress = useProgress();
  const { metas } = useUserCourses();
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<SkillLevel>("intermediate");
  const [topicError, setTopicError] = useState<string | null>(null);
  const { busy, error, setError, start } = useStartBuild();
  const card = useRef<HTMLDivElement>(null);
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => { h1.current?.focus(); }, []);
  useEffect(() => {
    if (me && (welcomed(me.user) || Object.keys(progress.levels).length > 0 || metas.some((m) => m.mine))) go(href.home());
  }, [me, progress, metas]);

  const done = () => markWelcomed(me?.user);
  const build = () => {
    const p = checkForm({ ...emptyForm, topic: { topic, web: "" } });
    setTopicError(p?.message ?? null);
    if (p) return;
    done();
    start({ mode: "topic", topic: topic.trim(), level, lang: /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(navigator.language) ? navigator.language : "en" });
  };

  return (
    <>
      <Hud />
      <div className="scr welcome">
        <div className="welcome-top">
          <Questie mood="cheer" />
          <button type="button" className="btn quiet" onClick={() => { done(); go(href.home()); }}>Skip</button>
        </div>
        <h1 ref={h1} tabIndex={-1}>What do you want to learn?</h1>
        {me?.features.ai && (
          <div ref={card} className="card build-form">
            <TopicField value={topic} onChange={(v) => { setTopic(v); setTopicError(null); setError(null); }}
              error={topicError ?? (topic.length > 200 ? "Use 200 characters or fewer" : error?.suggestions ? error.message : null)}
              suggestions={error?.suggestions} onPick={(s) => { setTopic(s); setError(null); card.current?.querySelector<HTMLElement>(".build-actions button")?.focus(); }}
              onEnter={() => pressBuild(card.current)} />
            <LevelField value={level} onChange={setLevel} />
            <div className="build-actions"><BuildButton mode="topic" busy={busy} onPress={build} /></div>
            {error && !error.suggestions && <p className="wa-error" role="alert">{error.message}</p>}
          </div>
        )}
        <section className="scr">
          <h2>Library</h2>
          <ul className="home-courses">
            {COURSES.filter((c) => !c.users).slice(0, 3).map((c) => (
              <li key={c.id}>
                <a className="course-card card" href={href.map(c.id)} onClick={done}>
                  <span className="course-body"><b>{c.title}</b><span className="course-meta">{c.levels.length} levels</span></span>
                </a>
              </li>
            ))}
          </ul>
          <a href={href.library()} onClick={done}>Browse library</a>
        </section>
      </div>
    </>
  );
}
