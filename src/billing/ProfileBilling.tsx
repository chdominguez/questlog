import { useState } from "react";
import { PLAN } from "../../shared/pricing";
import { isDemo, isNative } from "../platform";
import { useSession } from "../auth/session";
import { href } from "../ui/route";
import { portal } from "./api";
import { day, num, price, live } from "./format";
import { openTopUp } from "./topup";
import "./billing.css";

const STORE = { app_store: "App Store", play_store: "Google Play" } as const;

/** Profile: Plan and Credits sections; hidden when billing is off. */
export function ProfileBilling() {
  const c = useSession().me?.credits;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!c || isDemo) return null;
  const s = live(c) ? c.subscription! : null;
  const store = s?.provider === "revenuecat";
  // Web subscribers manage in the Stripe portal (never shown in the native app); store subscribers in the store.
  const canManage = s && (store ? isNative : !isNative);

  async function manage() {
    setBusy(true); setFailed(false);
    try {
      const url = store ? await (await import("../native/purchases")).managementUrl() : (await portal()).url;
      if (!url) throw new Error("no url");
      location.href = url;
    } catch { setFailed(true); setBusy(false); }
  }

  return (
    <>
      <section className="profile-billing">
        <h2>Plan</h2>
        {!s && <><p>Free</p><a className="btn" href={href.plans()}>Subscribe</a></>}
        {s && (store
          ? <p>Questie · {s.store ? STORE[s.store] : "App Store"}</p>
          : <p>Questie{!isNative && ` · ${price(PLAN.priceCents)} / month`}</p>)}
        {s?.status === "past_due" && <p><span className="pill pill-bad">Payment failed</span></p>}
        {s?.status === "active" && s.periodEnd && (s.cancelAtPeriodEnd
          ? <p><span className="pill pill-mid">Ends {day(s.periodEnd)}</span></p>
          : <p>Renews {day(s.periodEnd)}</p>)}
        {canManage && (
          <button type="button" className="btn ghost" disabled={busy} onClick={manage}>
            {busy ? "Opening…" : s.status === "past_due" && !store ? "Update payment" : "Manage"}
          </button>
        )}
        {failed && <p className="wa-notice" role="alert">Couldn't open billing</p>}
      </section>
      <section className="profile-billing">
        <h2>Credits</h2>
        <p>{num(c.total)}{(c.plan > 0 || c.planExpiresAt) && ` · ${num(c.plan)} plan · ${num(c.topup)} top-up`}</p>
        <div className="row">
          <button type="button" className="btn" onClick={() => openTopUp()}>Top up</button>
          <a className="btn ghost" href={href.credits()}>History</a>
        </div>
      </section>
    </>
  );
}
