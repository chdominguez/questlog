import { useEffect, useRef, useState } from "react";
import type { FulfillResult } from "../../shared/api-types";
import { ApiError } from "../api";
import { loadMe, setBalance } from "../auth/session";
import { Hud } from "../engine/Hud";
import { Questie } from "../questie/Questie";
import { checkoutReturn, fulfill } from "./api";
import { num } from "./format";
import { openTopUp } from "./topup";
import "../screens/screens.css";
import "./billing.css";

type View = "confirming" | "subscribed" | "added" | "processing" | "unpaid" | "timeout" | "missing";
const TITLE: Record<View, string> = {
  confirming: "Confirming payment…", subscribed: "Subscribed", added: "Credits added", processing: "Payment processing",
  unpaid: "Payment not completed", timeout: "Still confirming", missing: "Payment not found",
};
const MOOD = { confirming: "think", subscribed: "cheer", added: "happy" } as const;
const POLL_MS = 20_000;

/** Stripe success_url lands here with ?session_id= before the hash; polls fulfill up to 20 s. */
export function BillingDoneScreen() {
  const [sid] = useState(() => new URLSearchParams(location.search).get("session_id"));
  const [view, setView] = useState<View>(sid ? "confirming" : "missing");
  const [res, setRes] = useState<FulfillResult | null>(null);
  const [round, setRound] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);

  // Drop the query so a refresh does not fulfill again.
  useEffect(() => { if (location.search) history.replaceState(null, "", location.pathname + location.hash); }, []);
  useEffect(() => {
    if (!sid) return;
    let stop = false;
    const until = Date.now() + POLL_MS;
    setView("confirming");
    (async () => {
      while (!stop) {
        try {
          const r = await fulfill(sid);
          if (stop) return;
          setRes(r);
          setBalance(r.balance);
          if (r.status === "paid" && r.credited > 0) { loadMe(); return setView(r.item === "plan" ? "subscribed" : "added"); }
          if (r.status === "processing") return setView("processing");
          if (r.status === "unpaid" || r.status === "expired") return setView("unpaid");
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) return setView("missing");
        }
        if (Date.now() > until) return setView("timeout");
        await new Promise((r) => setTimeout(r, 2000));
      }
    })();
    return () => { stop = true; };
  }, [sid, round]);
  useEffect(() => { title.current?.focus(); }, [view]);

  const done = () => { location.hash = checkoutReturn(); };
  const paid = view === "subscribed" || view === "added";
  return (
    <>
      <Hud />
      <div className="scr billing-done" aria-busy={view === "confirming" || undefined}>
        <Questie mood={MOOD[view as keyof typeof MOOD] ?? "idle"} />
        <div aria-live="polite"><h1 ref={title} tabIndex={-1}>{TITLE[view]}</h1></div>
        {paid && res && <p>+{num(res.credited)} credits · Balance {num(res.balance)}</p>}
        {view === "processing" && <p>Credits added when payment clears</p>}
        {view !== "confirming" && (
          <div className="row center">
            {view === "unpaid" && <button type="button" className="btn" onClick={() => openTopUp()}>Try again</button>}
            {view === "timeout" && <button type="button" className="btn" onClick={() => setRound((n) => n + 1)}>Refresh</button>}
            <button type="button" className={view === "unpaid" || view === "timeout" ? "btn ghost" : "btn"} onClick={done}>Continue</button>
          </div>
        )}
      </div>
    </>
  );
}
