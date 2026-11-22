import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import type { CheckoutItem, Credits } from "../../shared/api-types";
import { PACKS, PLAN } from "../../shared/pricing";
import { isDemo, isNative, platform } from "../platform";
import { getMe, loadMe, useSession } from "../auth/session";
import { href } from "../ui/route";
import { checkout } from "./api";
import { Dialog } from "./Dialog";
import { live, num, price } from "./format";
import { closeTopUp, useTopUp } from "./topup";

interface Offer { id: string; item: CheckoutItem; price: string }

const WEB: Offer[] = [
  { id: "plan", item: "plan", price: price(PLAN.priceCents) },
  { id: "pack_s", item: "pack_s", price: price(PACKS.pack_s.priceCents) },
  { id: "pack_l", item: "pack_l", price: price(PACKS.pack_l.priceCents) },
];
const label = (o: Offer) => (o.item === "plan" ? `Subscribe · ${o.price}/mo` : `${num(PACKS[o.item].credits)} credits · ${o.price}`);
const purchases = () => import("../native/purchases");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Opens on a 402 and from Top up buttons. Web: Stripe Checkout. Native: store purchases via RevenueCat. */
export function TopUpSheet() {
  const t = useTopUp();
  const credits = useSession().me?.credits;
  if (!t.open || !credits || isDemo) return null;
  return <Sheet credits={credits} cost={t.cost} balance={t.balance} />;
}

function Sheet({ credits, cost, balance }: { credits: Credits; cost?: number; balance?: number }) {
  const [offers, setOffers] = useState<Offer[] | null | "failed">(isNative ? null : WEB);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [alert, setAlert] = useState("");
  const [pending, setPending] = useState(false);

  const loadOffers = () => { setOffers(null); purchases().then((p) => p.offerings()).then(setOffers, () => setOffers("failed")); };
  useEffect(() => { if (isNative) loadOffers(); }, []);

  const shown = Array.isArray(offers) ? offers.filter((o) => o.item !== "plan" || !live(credits)) : [];
  const native = isNative && !!busy;

  async function buyWeb(o: Offer) {
    setBusy(o.id); setAlert("");
    try { await checkout(o.item); } catch { setAlert("Couldn't open checkout"); setBusy(null); }
  }

  async function buyNative(o: Offer) {
    setBusy(o.id); setAlert(""); setStatus(""); setPending(false);
    try {
      const r = await (await purchases()).purchase(o.id);
      if (r === "pending") setStatus("Waiting for approval");
      if (r !== "ok") return;
      setStatus("Adding credits…");
      const start = getMe()?.credits?.total;
      for (let i = 0; i < 15; i++) {
        await sleep(2000);
        await loadMe();
        if (getMe()?.credits?.total !== start) {
          setStatus(o.item === "plan" ? "Subscribed" : "Credits added");
          setTimeout(closeTopUp, 1000);
          return;
        }
      }
      setStatus("Credits pending");
      setPending(true);
    } catch { setAlert("Purchase failed"); } finally { setBusy(null); }
  }

  async function restore() {
    setBusy("restore"); setAlert(""); setStatus("");
    try { const found = await (await purchases()).restore(); await loadMe(); setStatus(found ? "Purchases restored" : "Nothing to restore"); }
    catch { setAlert("Purchase failed"); } finally { setBusy(null); }
  }

  const short = cost !== undefined;
  return (
    <Dialog sheet onClose={closeTopUp} closable={!native} title={short ? "Not enough credits" : "Top up"}
      line={short ? `Needs ${num(cost)} · You have ${num(balance ?? credits.total)}` : `Balance ${num(credits.total)}`}>
      <button type="button" className="iconbtn dialog-close" aria-label="Close" disabled={native} onClick={closeTopUp}><X aria-hidden /></button>
      {offers === null && <p className="wa-notice" aria-busy="true">Loading…</p>}
      {offers === "failed" && (
        <div className="row"><p className="wa-notice" role="alert">Store unavailable</p><button type="button" className="btn ghost" onClick={loadOffers}>Retry</button></div>
      )}
      <div className="topup-opts">
        {shown.map((o, i) => (
          <div key={o.id} className="topup-opt">
            <button type="button" className={i === 0 ? "btn" : "btn ghost"} disabled={!!busy} data-autofocus={i === 0 || undefined}
              onClick={() => (isNative ? buyNative(o) : buyWeb(o))}>
              {busy === o.id ? (isNative ? "Purchasing…" : "Opening checkout…") : label(o)}
            </button>
            {o.item === "plan" && <small>{num(PLAN.credits)} credits / month</small>}
          </div>
        ))}
      </div>
      {status && <p className="wa-notice" role="status">{status}</p>}
      {alert && <p className="wa-notice" role="alert">{alert}</p>}
      <div className="row">
        {pending && <button type="button" className="btn ghost" onClick={() => loadMe()}>Refresh</button>}
        <a className="btn quiet" href={href.plans()} onClick={closeTopUp}>Plans</a>
        {isNative && platform === "ios" && (
          <button type="button" className="btn quiet" disabled={!!busy} onClick={restore}>{busy === "restore" ? "Restoring…" : "Restore purchases"}</button>
        )}
      </div>
    </Dialog>
  );
}
