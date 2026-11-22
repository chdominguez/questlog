import { useEffect, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import type { LedgerRow } from "../../shared/api-types";
import { useSession } from "../auth/session";
import { Hud } from "../engine/Hud";
import { NotFound } from "../screens/NotFound";
import { href } from "../ui/route";
import { getLedger } from "./api";
import { day, lines, month, num, signed, type Line } from "./format";
import { openTopUp } from "./topup";
import "../answers/answers.css";
import "../screens/screens.css";
import "./billing.css";

export function CreditsScreen() {
  const c = useSession().me?.credits;
  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "idle" | "error">("loading");

  const load = async (before?: string | null) => {
    setState("loading");
    try {
      const p = await getLedger(before);
      setRows((r) => (before ? [...(r ?? []), ...p.rows] : p.rows));
      setNext(p.next);
      setState("idle");
    } catch { setState("error"); }
  };
  useEffect(() => { if (c) load(); }, []);
  if (!c) return <NotFound />;

  const months: [string, Line[]][] = [];
  for (const l of lines(rows ?? [])) {
    const m = month(l.at);
    if (months.at(-1)?.[0] !== m) months.push([m, []]);
    months.at(-1)![1].push(l);
  }

  return (
    <>
      <Hud />
      <div className="scr">
        <div className="scr-head">
          <a className="back" href={href.profile()} aria-label="Back"><ArrowLeft aria-hidden /></a>
          <h1>Credits</h1>
        </div>
        <section className="card balance-card">
          <div>
            <p className="balance-big">{num(c.total)}</p>
            {(c.plan > 0 || c.planExpiresAt) && <p>{num(c.plan)} plan · {num(c.topup)} top-up</p>}
            {c.planExpiresAt && <p>Plan credits reset {day(c.planExpiresAt)}</p>}
          </div>
          <button type="button" className="btn" onClick={() => openTopUp()}>Top up</button>
        </section>
        {months.map(([m, ls]) => (
          <section key={m}>
            <h2>{m}</h2>
            <div className="tbl">
              <table>
                <thead className="sr"><tr><th>Date</th><th>Activity</th><th>Credits</th></tr></thead>
                <tbody>
                  {ls.map((l) => (
                    <tr key={l.key}>
                      <td className="ledger-day">{day(l.at)}</td>
                      <td>{l.label}</td>
                      <td className={`delta${l.delta > 0 ? " up" : ""}`}>{signed(l)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        {rows?.length === 0 && <p className="scr-empty">No activity</p>}
        {state === "error" && (
          <div className="row"><p className="wa-notice" role="alert">Couldn't load credits</p><button type="button" className="btn ghost" onClick={() => load(next)}>Retry</button></div>
        )}
        {state === "loading" && !rows && <p className="scr-empty" aria-busy="true">Loading…</p>}
        {next && state !== "error" && (
          <button type="button" className="btn ghost" disabled={state === "loading"} onClick={() => load(next)}>{state === "loading" ? "Loading…" : "Show more"}</button>
        )}
      </div>
    </>
  );
}
