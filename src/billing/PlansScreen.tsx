import { useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import type { Action, CheckoutItem } from "../../shared/api-types";
import { PACKS, PLAN } from "../../shared/pricing";
import { isNative } from "../platform";
import { useSession } from "../auth/session";
import { Hud } from "../engine/Hud";
import { NotFound } from "../screens/NotFound";
import { href } from "../ui/route";
import { checkout, portal } from "./api";
import { day, num, price, live } from "./format";
import { openTopUp } from "./topup";
import "../answers/answers.css";
import "../screens/screens.css";
import "./billing.css";

const COST_ROWS: [Action, string][] = [
  ["course_topic", "Course from a topic"], ["course_files", "Course from files, notes, URL or repo"], ["course_web", "Course from web research"],
  ["grade", "Grade an answer"], ["improve", "Stronger answer"], ["mock", "Mock exam"], ["narration", "Narrated lesson"],
];
const STORE = { app_store: "App Store", play_store: "Google Play" } as const;

export function PlansScreen({ canceled }: { canceled: boolean }) {
  const c = useSession().me?.credits;
  const [busy, setBusy] = useState<CheckoutItem | "portal" | null>(null);
  const [alert, setAlert] = useState("");
  if (!c) return <NotFound />;
  const s = live(c) ? c.subscription! : null;
  const stripe = s?.provider === "stripe";

  async function buy(item: CheckoutItem) {
    if (isNative) return openTopUp(); // store purchases only
    setBusy(item); setAlert("");
    try { await checkout(item); } catch { setAlert("Couldn't open checkout"); setBusy(null); }
  }
  async function manage() {
    setBusy("portal"); setAlert("");
    try { location.href = (await portal()).url; } catch { setAlert("Couldn't open billing"); setBusy(null); }
  }
  const btn = (item: CheckoutItem, text: string, cls = "btn") => (
    <button type="button" className={cls} disabled={!!busy} onClick={() => buy(item)}>{busy === item ? "Opening checkout…" : text}</button>
  );
  const manageBtn = (text: string, cls: string) => stripe && !isNative && (
    <button type="button" className={cls} disabled={!!busy} onClick={manage}>{busy === "portal" ? "Opening…" : text}</button>
  );

  return (
    <>
      <Hud />
      <div className="scr">
        <div className="scr-head">
          <a className="back" href={href.profile()} aria-label="Back"><ArrowLeft aria-hidden /></a>
          <h1>Plans</h1>
        </div>
        {canceled && <p className="wa-notice" role="status">Checkout canceled</p>}
        {alert && <p className="wa-notice" role="alert">{alert}</p>}
        {c.notice && <p className="card">{c.notice}</p>}
        <div className="plans">
          <section className="card plan-card">
            <h2>Free</h2>
            {!isNative && <p className="plan-price">€0</p>}
            <ul><li>Every library course</li><li>Games, katas, review, notes</li><li>1 AI course</li></ul>
            {!s && <button type="button" className="btn ghost" disabled>Current plan</button>}
          </section>
          <section className="card plan-card">
            <h2>Questie</h2>
            {!isNative && <p className="plan-price">{price(PLAN.priceCents)} / month</p>}
            <p>{num(PLAN.credits)} credits / month</p>
            <ul><li>Everything in Free</li><li>AI courses from topics, files and web research</li><li>AI grading</li><li>Narrated lessons</li></ul>
            {!s && btn("plan", "Subscribe")}
            {s?.status === "past_due" && <><span className="pill pill-bad">Payment failed</span>{manageBtn("Update payment", "btn")}</>}
            {s?.status === "active" && (
              <div className="row">
                {s.cancelAtPeriodEnd && s.periodEnd
                  ? <span className="pill pill-mid">Ends {day(s.periodEnd)}</span>
                  : <button type="button" className="btn ghost" disabled>Current plan</button>}
                {s.store && <span className="tag">{STORE[s.store]}</span>}
                {manageBtn("Manage", "btn ghost")}
              </div>
            )}
          </section>
        </div>
        {!isNative && <p className="plans-note">VAT included</p>}

        <h2>Top-ups</h2>
        <div className="plans">
          {(Object.keys(PACKS) as (keyof typeof PACKS)[]).map((k) => (
            <section key={k} className="card plan-card">
              <p className="row"><b>{num(PACKS[k].credits)} credits</b>{!isNative && <span>{price(PACKS[k].priceCents)}</span>}</p>
              {btn(k, "Buy", "btn ghost")}
            </section>
          ))}
        </div>
        <p className="plans-note">Top-up credits never expire</p>

        <h2>Credit costs</h2>
        <div className="tbl">
          <table>
            <tbody>{COST_ROWS.map(([a, text]) => <tr key={a}><td>{text}</td><td className="delta">{num(c.costs[a])}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="plans-note">Plan credits reset each month. Spent before top-ups.</p>
      </div>
    </>
  );
}
